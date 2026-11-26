import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { verifyGoogleIdToken } from '@/lib/security/googleIdToken';
import { createSession } from '@/lib/security/session';
<<<<<<< HEAD
import { registeredUsersStore, registerOrLoginWithGoogle } from '@/services/authStore';
=======
import { registeredUsersStore, registerOrLoginWithGoogle } from '@/lib/services/authStore';
>>>>>>> origin/main
import { POST as googlePost } from '@/app/api/auth/google/route';
import { GET as pansGet, POST as pansPost } from '@/app/api/pans/route';
import {
  GET as applicationsGet,
  POST as applicationsPost,
  PATCH as applicationsPatch,
} from '@/app/api/applications/route';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...(publicKey.export({ format: 'jwk' }) as crypto.JsonWebKey), kid: 'test-kid' };
const getKeys = async () => [jwk];

function signIdToken(claims: Record<string, unknown>, kid = 'test-kid'): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

function validClaims(overrides: Record<string, unknown> = {}) {
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: '1234567890',
    email: 'verified.user@gmail.com',
    email_verified: true,
    name: 'Verified User',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

function jsonRequest(url: string, method: string, body?: unknown, sessionToken?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionToken) headers.cookie = `ipolens_session=${sessionToken}`;
  return new Request(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

async function sessionFor(email: string): Promise<string> {
  const result = registerOrLoginWithGoogle({ email, name: email.split('@')[0] });
  const { token } = await createSession(result.user!.id, false);
  return token;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Google ID token verification', () => {
  it('accepts a correctly signed token for the configured client', async () => {
    const claims = await verifyGoogleIdToken(signIdToken(validClaims()), { clientId: CLIENT_ID, getKeys });
    expect(claims.email).toBe('verified.user@gmail.com');
  });

  it('rejects a token issued for a different client', async () => {
    await expect(
      verifyGoogleIdToken(signIdToken(validClaims({ aud: 'other.apps.googleusercontent.com' })), { clientId: CLIENT_ID, getKeys })
    ).rejects.toThrow(/different client/);
  });

  it('rejects expired tokens, unverified emails and bad issuers', async () => {
    const expired = signIdToken(validClaims({ exp: Math.floor(Date.now() / 1000) - 3600 }));
    await expect(verifyGoogleIdToken(expired, { clientId: CLIENT_ID, getKeys })).rejects.toThrow(/expired/);

    const unverified = signIdToken(validClaims({ email_verified: false }));
    await expect(verifyGoogleIdToken(unverified, { clientId: CLIENT_ID, getKeys })).rejects.toThrow(/not verified/);

    const badIssuer = signIdToken(validClaims({ iss: 'https://evil.example.com' }));
    await expect(verifyGoogleIdToken(badIssuer, { clientId: CLIENT_ID, getKeys })).rejects.toThrow(/issuer/);
  });

  it('rejects a token whose payload was tampered with', async () => {
    const [header, , signature] = signIdToken(validClaims()).split('.');
    const forgedPayload = Buffer.from(JSON.stringify(validClaims({ email: 'victim@gmail.com' }))).toString('base64url');
    await expect(
      verifyGoogleIdToken(`${header}.${forgedPayload}.${signature}`, { clientId: CLIENT_ID, getKeys })
    ).rejects.toThrow(/signature/);
  });

  it('rejects a token signed with an unknown key', async () => {
    await expect(
      verifyGoogleIdToken(signIdToken(validClaims(), 'unknown-kid'), { clientId: CLIENT_ID, getKeys })
    ).rejects.toThrow(/unknown key/);
  });
});

describe('POST /api/auth/google', () => {
  it('in production, rejects a forged email-only payload (account takeover)', async () => {
    registerOrLoginWithGoogle({ email: 'victim.account@gmail.com', name: 'Victim' });
    vi.stubEnv('NODE_ENV', 'production');

    const res = await googlePost(jsonRequest('http://localhost/api/auth/google', 'POST', { email: 'victim.account@gmail.com', name: 'Attacker' }));
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('rejects an invalid credential even outside production', async () => {
    const res = await googlePost(
      jsonRequest('http://localhost/api/auth/google', 'POST', { credential: 'not.a.jwt', email: 'victim.account@gmail.com' })
    );
    expect(res.status).toBe(401);
  });

  it('does not return the session token in the response body', async () => {
    const res = await googlePost(jsonRequest('http://localhost/api/auth/google', 'POST', { email: 'dev.demo@gmail.com', name: 'Dev' }));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.token).toBeUndefined();
    expect(res.headers.get('set-cookie')).toContain('ipolens_session=');
  });
});

describe('Per-user data isolation', () => {
  it('returns 401 for unauthenticated PAN and application requests', async () => {
    expect((await pansGet(jsonRequest('http://localhost/api/pans', 'GET'))).status).toBe(401);
    expect((await pansPost(jsonRequest('http://localhost/api/pans', 'POST', { name: 'X', pan: 'ABCDE1234F', relationship: 'Self' }))).status).toBe(401);
    expect((await applicationsGet(jsonRequest('http://localhost/api/applications', 'GET'))).status).toBe(401);
  });

  it('keeps one user\'s PANs and applications invisible and immutable to another', async () => {
    const alice = await sessionFor('alice.isolation@gmail.com');
    const bob = await sessionFor('bob.isolation@gmail.com');

    const panRes = await pansPost(
      jsonRequest('http://localhost/api/pans', 'POST', { name: 'Alice', pan: 'ALICE1234F', relationship: 'Self', broker: 'Zerodha' }, alice)
    );
    expect(panRes.status).toBe(200);

    const bobPans = await (await pansGet(jsonRequest('http://localhost/api/pans', 'GET', undefined, bob))).json();
    expect(bobPans.data).toHaveLength(0);
    const alicePans = await (await pansGet(jsonRequest('http://localhost/api/pans', 'GET', undefined, alice))).json();
    expect(alicePans.data.length).toBeGreaterThan(0);

    const appRes = await applicationsPost(
      jsonRequest('http://localhost/api/applications', 'POST', { ipoSymbol: 'TESTIPO', panId: alicePans.data[0].id, panNumber: 'ALICE1234F', bidPrice: 100, lots: 1 }, alice)
    );
    const appJson = await appRes.json();
    expect(appJson.success).toBe(true);

    const bobApps = await (await applicationsGet(jsonRequest('http://localhost/api/applications', 'GET', undefined, bob))).json();
    expect(bobApps.data).toHaveLength(0);

    const patchRes = await applicationsPatch(
      jsonRequest('http://localhost/api/applications', 'PATCH', { id: appJson.data.id, status: 'Refunded' }, bob)
    );
    expect(patchRes.status).toBe(404);
  });
});

describe('PAN encryption key', () => {
  it('refuses to encrypt in production without PAN_ENCRYPTION_KEY', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PAN_ENCRYPTION_KEY', '');
    vi.stubEnv('NEXTAUTH_SECRET', '');
    const { encryptPan } = await import('@/lib/security/panEncryption');
    expect(() => encryptPan('ABCDE1234F')).toThrow(/PAN_ENCRYPTION_KEY/);
  });

  it('round-trips when a key is configured', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PAN_ENCRYPTION_KEY', 'test-key-for-round-trip');
    const { encryptPan, decryptPan } = await import('@/lib/security/panEncryption');
    expect(decryptPan(encryptPan('abcde1234f'))).toBe('ABCDE1234F');
  });
});

// Keep the shared in-memory user store from leaking test accounts into other suites.
afterEach(() => {
  for (let i = registeredUsersStore.length - 1; i >= 0; i--) {
    if (/(victim\.account|alice\.isolation|bob\.isolation|dev\.demo)@gmail\.com/.test(registeredUsersStore[i].email)) {
      registeredUsersStore.splice(i, 1);
    }
  }
});
