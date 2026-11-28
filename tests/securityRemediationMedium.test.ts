import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { NextRequest } from 'next/server';
import { createSession, getAuthenticatedUser } from '@/lib/security/session';
import { registeredUsersStore, registerOrLoginWithGoogle } from '@/services/authStore';

/**
 * Regression tests for the Medium and Low findings (docs/security/AUDIT_2026-11-27.md),
 * remediation steps R11–R17. Each fails on main@ebd30a0.
 */

const DOMAIN = '@remediation-medium.test';

function jsonRequest(url: string, method: string, body?: unknown, sessionToken?: string, extra: Record<string, string> = {}): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  if (sessionToken) headers.cookie = `ipolens_session=${sessionToken}`;
  return new Request(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

async function sessionFor(name: string, primaryPan?: string): Promise<string> {
  const result = registerOrLoginWithGoogle({ email: `${name}${DOMAIN}`, name, primaryPan });
  const { token } = await createSession(result.user!.id, false);
  return token;
}

async function addPan(token: string, name: string, pan: string): Promise<string> {
  const { POST } = await import('@/app/api/pans/route');
  const json = await (await POST(jsonRequest('http://localhost/api/pans', 'POST', { name, pan, relationship: 'Spouse' }, token))).json();
  expect(json.success).toBe(true);
  return json.data.id as string;
}

afterEach(() => {
  vi.unstubAllEnvs();
  for (let i = registeredUsersStore.length - 1; i >= 0; i--) {
    if (registeredUsersStore[i].email.endsWith(DOMAIN)) registeredUsersStore.splice(i, 1);
  }
});

describe('R11 / M5: validated, server-derived application data', () => {
  it('rejects negative quantities, bad statuses and malformed PANs with 400', async () => {
    const { POST, PATCH } = await import('@/app/api/applications/route');
    const { POST: pansPost } = await import('@/app/api/pans/route');
    const user = await sessionFor('m5.validate');
    const panId = await addPan(user, 'Valid Holder', 'VALID1234F');
    const url = 'http://localhost/api/applications';
    expect((await POST(jsonRequest(url, 'POST', { ipoSymbol: 'M5IPO', panId, lots: 1, bidPrice: 100, shares: -50 }, user))).status).toBe(400);
    expect((await POST(jsonRequest(url, 'POST', { ipoSymbol: 'M5IPO', panId, lots: 1, bidPrice: -100 }, user))).status).toBe(400);
    expect((await PATCH(jsonRequest(url, 'PATCH', { id: 'app_x', status: 'Hacked' }, user))).status).toBe(400);
    expect((await PATCH(jsonRequest(url, 'PATCH', { id: 'app_x', status: 'Allotted', allottedShares: -1 }, user))).status).toBe(400);
    expect((await pansPost(jsonRequest('http://localhost/api/pans', 'POST', { name: 'X', pan: 'NOTAPAN', relationship: 'Self' }, user))).status).toBe(400);
    expect((await pansPost(jsonRequest('http://localhost/api/pans', 'POST', { name: 'X', pan: 'ABCDE1234F', relationship: 'Boss' }, user))).status).toBe(400);
  });

  it("takes holder, PAN and relationship from the caller's own profile, and refuses another user's panId", async () => {
    const { POST } = await import('@/app/api/applications/route');
    const owner = await sessionFor('m5.owner');
    const other = await sessionFor('m5.other');
    const panId = await addPan(owner, 'Real Holder', 'REALH1234F');

    const res = await POST(
      jsonRequest('http://localhost/api/applications', 'POST',
        { ipoSymbol: 'M5IPO', panId, lots: 1, bidPrice: 100, holderName: 'Spoofed Name', panNumber: 'ZZZZZ9999Z', relationship: 'Self' }, owner)
    );
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.holderName).toBe('Real Holder');
    expect(json.data.panNumber).toBe('REALH****F');
    expect(json.data.relationship).toBe('Spouse');

    const foreign = await POST(jsonRequest('http://localhost/api/applications', 'POST', { ipoSymbol: 'M5IPO', panId, lots: 1, bidPrice: 100 }, other));
    expect(foreign.status).toBe(404);
  });

  it('detects an exact duplicate PAN but not a different PAN with the same masked form', async () => {
    const user = await sessionFor('m5.dup');
    await addPan(user, 'First', 'DUPLX1234F');
    const { POST } = await import('@/app/api/pans/route');
    const dup = await POST(jsonRequest('http://localhost/api/pans', 'POST', { name: 'Again', pan: 'DUPLX1234F', relationship: 'Spouse' }, user));
    expect(dup.status).toBe(400);
    // Same first five letters and last letter (same mask DUPLX****F), different PAN: allowed.
    const different = await POST(jsonRequest('http://localhost/api/pans', 'POST', { name: 'Other', pan: 'DUPLX9876F', relationship: 'Child' }, user));
    expect(different.status).toBe(200);
  });

  it('never stores an unknown investor category or derives a role from it', async () => {
    const result = registerOrLoginWithGoogle({ email: `m5.cat${DOMAIN}`, name: 'Cat', investorCategory: 'Superuser' as any });
    expect(result.user?.investorCategory).toBe('Retail');
    expect(result.user?.role).toBe('retail');
  });
});

describe('R12 / M1 + M8 + L5: own-PAN allotment checks, masked PAN, public user DTO', () => {
  it('requires login and an owned PAN for allotment checks', async () => {
    const { GET, POST } = await import('@/app/api/allotment/check/route');
    const symbol = (await (await GET()).json()).data.ipos[0]?.symbol;
    expect(symbol).toBeTruthy();
    const url = 'http://localhost/api/allotment/check';

    expect((await POST(jsonRequest(url, 'POST', { symbol, pan: 'ABCDE1234F' }))).status).toBe(401);

    const user = await sessionFor('m1.owner', 'OWNPN1234F');
    const stranger = await POST(jsonRequest(url, 'POST', { symbol, pan: 'STRNG1234F' }, user));
    expect(stranger.status).toBe(403);

    const own = await POST(jsonRequest(url, 'POST', { symbol, pan: 'OWNPN1234F' }, user));
    expect([401, 403]).not.toContain(own.status);

    await addPan(user, 'Family', 'FAMLY1234F');
    const family = await POST(jsonRequest(url, 'POST', { symbol, pan: 'FAMLY1234F' }, user));
    expect([401, 403]).not.toContain(family.status);
  });

  it('stores and returns the primary PAN masked, and never returns hashes or salts', async () => {
    const token = await sessionFor('m8.mask', 'MASKD1234F');
    const stored = registeredUsersStore.find((u) => u.email === `m8.mask${DOMAIN}`)!;
    expect(stored.primaryPan).toBe('MASKD****F');

    const { GET } = await import('@/app/api/auth/me/route');
    const me = await (await GET(jsonRequest('http://localhost/api/auth/me', 'GET', undefined, token))).json();
    const text = JSON.stringify(me);
    expect(me.user.primaryPan).toBe('MASKD****F');
    expect(text).not.toContain('MASKD1234F');
    expect(text).not.toMatch(/passwordHash|passwordSalt|primaryPanHash|"salt"/);
  });

  it('no longer caches the user profile in localStorage', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../src/context/AuthContext.tsx'), 'utf8');
    expect(src).not.toMatch(/localStorage\.setItem/);
  });
});

describe('R13 / M3: nonce-based CSP', () => {
  it('gives pages a per-request nonce CSP without unsafe-inline scripts', async () => {
    const { proxy } = await import('@/proxy');
    const a = (await proxy(new NextRequest('http://localhost/'))).headers.get('content-security-policy') || '';
    const b = (await proxy(new NextRequest('http://localhost/'))).headers.get('content-security-policy') || '';
    const scriptSrc = a.split(';').find((d) => d.trim().startsWith('script-src')) || '';
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(a).not.toMatch(/connect-src[^;]*\bwss?:(?!\/\/localhost)/);
    expect(a).not.toBe(b);
  });

  it('gives API responses a deny-all CSP', async () => {
    const config = (await import('../next.config')).default;
    const rules = await config.headers!();
    const api = rules.find((r) => r.source === '/api/:path*');
    const csp = api?.headers.find((h) => h.key === 'Content-Security-Policy')?.value || '';
    expect(csp).toContain("default-src 'none'");
  });
});

describe('R14 / M4: bounded live-data streams', () => {
  it('rejects too many or malformed symbols', async () => {
    const { GET } = await import('@/app/api/market/stream/route');
    const many = Array.from({ length: 21 }, (_, i) => `SYM${i}`).join(',');
    expect((await GET(new NextRequest(`http://localhost/api/market/stream?symbols=${many}`))).status).toBe(400);
    expect((await GET(new NextRequest('http://localhost/api/market/stream?symbols=%3Cscript%3E'))).status).toBe(400);
  });

  it('caps concurrent streams per client IP and frees the slot on disconnect', async () => {
    const { GET } = await import('@/app/api/market/stream/route');
    const controllers: AbortController[] = [];
    const open = () => {
      const c = new AbortController();
      controllers.push(c);
      return GET(new NextRequest('http://localhost/api/market/stream?symbols=SWIGGY', { headers: { 'x-forwarded-for': '198.51.100.77' }, signal: c.signal }));
    };
    const statuses: number[] = [];
    for (let i = 0; i < 9; i++) statuses.push((await open()).status);
    expect(statuses.slice(0, 8).every((s) => s === 200)).toBe(true);
    expect(statuses[8]).toBe(429);
    controllers.forEach((c) => c.abort());
    await new Promise((r) => setTimeout(r, 10));
    expect((await open()).status).toBe(200);
    controllers.forEach((c) => c.abort());
  });
});

describe('R15 / M9: the session token never reaches scripts', () => {
  it('sign-in sets only the HttpOnly session cookie and returns no token', async () => {
    const { POST } = await import('@/app/api/auth/signin/route');
    const res = await POST(jsonRequest('http://localhost/api/auth/signin', 'POST', { email: 'arjun.mehta@ipolens.in', password: 'DemoPass123!' }));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.token).toBeUndefined();
    const cookies = res.headers.get('set-cookie') || '';
    expect(cookies).toContain('ipolens_session=');
    expect(cookies).not.toContain('ipolens_token=');
    expect(cookies.toLowerCase()).toContain('httponly');
  });

  it('does not accept a session token as a Bearer header', async () => {
    const result = registerOrLoginWithGoogle({ email: `m9.bearer${DOMAIN}`, name: 'Bearer' });
    const { token } = await createSession(result.user!.id, false);
    const viaBearer = await getAuthenticatedUser(new Request('http://localhost/api/auth/me', { headers: { authorization: `Bearer ${token}` } }));
    expect(viaBearer).toBeNull();
  });
});

describe('R16 / M10: Upstox helper script', () => {
  it('local callback server ignores codes without the issued state', async () => {
    const { startLocalCallbackServer } = await import('../scripts/getUpstoxToken.mjs');
    const received: string[] = [];
    const maybeServer = startLocalCallbackServer(async (code: string) => { received.push(code); }, 'http://127.0.0.1:0/api/auth/callback/upstox', 'expected-state');
    expect(maybeServer).not.toBeNull();
    const server = maybeServer!;
    await new Promise<void>((r) => (server.listening ? r() : server.once('listening', () => r())));
    const { address, port } = server.address() as { address: string; port: number };
    expect(address).toBe('127.0.0.1');
    const status = await new Promise<number>((resolve) => {
      http.get(`http://127.0.0.1:${port}/api/auth/callback/upstox?code=evil&state=wrong`, (res) => { res.resume(); resolve(res.statusCode || 0); });
    });
    expect(status).toBe(400);
    expect(received).toEqual([]);
    server.close();
  });
});

describe('R17 / L1–L8', () => {
  it('L2: scraper sync rejects a wrong CRON secret', async () => {
    vi.stubEnv('CRON_SECRET', 'correct-cron-secret-value');
    const { POST } = await import('@/app/api/scraper/sync/route');
    const res = await POST(jsonRequest('http://localhost/api/scraper/sync', 'POST', {}, undefined, { authorization: 'Bearer wrong-secret' }));
    expect(res.status).toBe(403);
    const src = fs.readFileSync(path.resolve(__dirname, '../src/app/api/scraper/sync/route.ts'), 'utf8');
    expect(src).not.toMatch(/\bexec\(|execAsync/);
  });

  it('L3: requireAdmin denies anonymous and non-admin users', async () => {
    const { requireAdmin } = await import('@/lib/security/adminGuard');
    expect((await requireAdmin(new Request('http://localhost/admin')))?.status).toBe(401);
    const user = await sessionFor('l3.user');
    expect((await requireAdmin(jsonRequest('http://localhost/admin', 'GET', undefined, user)))?.status).toBe(403);
  });

  it('L4: sessions default to one day', async () => {
    const { expiresAt } = await createSession('usr_l4_test');
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
  });

  it('L6: no JWT-shaped literals in the test suite', () => {
    const dir = path.resolve(__dirname);
    const offenders = fs.readdirSync(dir).filter((f) => f.endsWith('.ts') && /eyJ[A-Za-z0-9_-]{10,}\.eyJ/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('L7: new account ids are random UUIDs', () => {
    const result = registerOrLoginWithGoogle({ email: `l7.id${DOMAIN}`, name: 'Id' });
    expect(result.user!.id).toMatch(/^usr_g_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('L8: internal error text is not returned in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { publicErrorMessage, errorDetail } = await import('@/lib/security/apiError');
    const err = new Error('relation "users" does not exist at /srv/app/db.ts:42');
    expect(publicErrorMessage(err)).toBe('Internal server error');
    expect(errorDetail(err)).toEqual({});
  });

  it('Google sign-in rejects an ID token whose nonce does not match', async () => {
    const crypto = await import('crypto');
    const { verifyGoogleIdToken } = await import('@/lib/security/googleIdToken');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = { ...(publicKey.export({ format: 'jwk' }) as any), kid: 'k1' };
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const header = enc({ alg: 'RS256', kid: 'k1' });
    const payload = enc({ iss: 'https://accounts.google.com', aud: 'cid', sub: '1', email: 'n@x.test', email_verified: true, exp: Math.floor(Date.now() / 1000) + 600, nonce: 'issued-nonce' });
    const sig = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
    const token = `${header}.${payload}.${sig}`;
    const getKeys = async () => [jwk];
    await expect(verifyGoogleIdToken(token, { clientId: 'cid', getKeys, expectedNonce: 'other-nonce' })).rejects.toThrow(/nonce/);
    await expect(verifyGoogleIdToken(token, { clientId: 'cid', getKeys, expectedNonce: '' })).rejects.toThrow(/nonce/);
    await expect(verifyGoogleIdToken(token, { clientId: 'cid', getKeys, expectedNonce: 'issued-nonce' })).resolves.toMatchObject({ email: 'n@x.test' });
  });
});
