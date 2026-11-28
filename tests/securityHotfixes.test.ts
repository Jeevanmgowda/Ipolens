import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { demoAccountsEnabled, escapeHtml } from '@/lib/security/guards';
import { createSession } from '@/lib/security/session';
import { POST as optimizeAllocation } from '@/app/api/pans/optimize-allocation/route';
import { GET as upstoxStart } from '@/app/api/auth/upstox/route';
import { GET as upstoxCallback } from '@/app/api/auth/callback/upstox/route';

const json = (url: string, body: unknown, cookie?: string) =>
  new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

const get = (url: string, cookie?: string) =>
  new NextRequest(`http://localhost${url}`, { headers: cookie ? { cookie } : {} });

async function cookieFor(userId: string) {
  const { token } = await createSession(userId, false);
  return `ipolens_session=${token}`;
}

describe('Hotfix: demo accounts never exist in production', () => {
  it('is enabled only for local development', () => {
    expect(demoAccountsEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(demoAccountsEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(demoAccountsEnabled({ NODE_ENV: 'development', ALLOW_DEMO_ACCOUNTS: 'false' })).toBe(false);
  });
});

describe('Hotfix: PAN-returning routes require sign-in and ignore client-supplied PANs', () => {
  it('optimize-allocation rejects anonymous callers', async () => {
    const res = await optimizeAllocation(json('/api/pans/optimize-allocation', { symbol: 'X', price: 100, lotSize: 10 }));
    expect(res.status).toBe(401);
  });

  it('the global multi-scan route has been removed', async () => {
    const fs = await import('fs');
    expect(fs.existsSync('src/app/api/allotment/multi-scan/route.ts')).toBe(false);
  });

  it('optimize-allocation does not echo PANs the client sends', async () => {
    const cookie = await cookieFor('usr_ret_02');
    const res = await optimizeAllocation(
      json(
        '/api/pans/optimize-allocation',
        { symbol: 'X', price: 100, lotSize: 10, pans: [{ id: 'evil', name: 'Victim', pan: 'ZZZZZ9999Z', relationship: 'Self', broker: 'x', createdAt: '' }] },
        cookie
      )
    );
    const text = await res.text();
    expect(text).not.toContain('ZZZZZ9999Z');
    expect(text).not.toContain('Victim');
  });
});

describe('Hotfix: Upstox OAuth is admin-only in production, state-bound and escaped', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('rejects anonymous callers and non-admins in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect((await upstoxStart(get('/api/auth/upstox'))).status).toBe(401);
    const retail = await cookieFor('usr_ret_02');
    expect((await upstoxStart(get('/api/auth/upstox', retail))).status).toBe(403);
    expect((await upstoxCallback(get('/api/auth/callback/upstox?code=abc', retail))).status).toBe(403);
  });

  it('issues a state cookie and requires it to match on callback', async () => {
    process.env.UPSTOX_CLIENT_ID = 'test-client-id';
    const admin = await cookieFor('usr_admin_00');
    const start = await upstoxStart(get('/api/auth/upstox', admin));
    expect(start.status).toBe(307);
    const location = start.headers.get('location') || '';
    const state = new URL(location).searchParams.get('state');
    expect(state).toMatch(/^[a-f0-9]{48}$/);
    expect(start.headers.get('set-cookie') || '').toContain('upstox_oauth_state=');

    // Wrong / missing state is refused before any token exchange.
    const bad = await upstoxCallback(get('/api/auth/callback/upstox?code=abc&state=forged', admin));
    expect(bad.status).toBe(400);
    expect(await bad.text()).toContain('state mismatch');
    const missing = await upstoxCallback(get(`/api/auth/callback/upstox?code=abc&state=${state}`, admin));
    expect(missing.status).toBe(400);
  });

  it('escapes reflected error text (no script injection)', async () => {
    const admin = await cookieFor('usr_admin_00');
    const state = 'a'.repeat(48);
    const payload = encodeURIComponent('<script>alert(document.cookie)</script>');
    const res = await upstoxCallback(
      get(`/api/auth/callback/upstox?error=${payload}&state=${state}`, `${admin}; upstox_oauth_state=${state}`)
    );
    const html = await res.text();
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;alert');
  });

  it('escapeHtml neutralises HTML metacharacters', () => {
    expect(escapeHtml(`<img src=x onerror="a('b')">&`)).toBe('&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
  });
});
