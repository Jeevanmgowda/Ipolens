import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { apiErrorResponse, errorDetail, publicErrorMessage } from '@/lib/security/apiError';
import { GET as upstoxCallback } from '@/app/api/auth/callback/upstox/route';
import { GET as upstoxLogin } from '@/app/api/auth/upstox/route';
import { UPSTOX_STATE_COOKIE } from '@/lib/security/upstoxOAuth';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('API error responses', () => {
  it('hides raw error text from clients in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('connect ECONNREFUSED 10.0.0.5:5432 password=hunter2');

    expect(publicErrorMessage(err, 'Something failed')).toBe('Something failed');
    expect(errorDetail(err)).toEqual({});

    const res = apiErrorResponse(err, '/api/test');
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json).toEqual({ success: false, error: 'Internal server error' });
    expect(console.error).toHaveBeenCalled();
  });

  it('keeps the real message outside production for debugging', () => {
    const err = new Error('detailed failure');
    expect(publicErrorMessage(err, 'fallback')).toBe('detailed failure');
    expect(errorDetail(err)).toEqual({ message: 'detailed failure' });
  });
});

describe('Upstox OAuth callback', () => {
  it('escapes the reflected error parameter (no XSS)', async () => {
    const payload = '<script>alert(document.cookie)</script>';
    const res = await upstoxCallback(
      new NextRequest(`http://localhost/api/auth/callback/upstox?error=${encodeURIComponent(payload)}`)
    );
    const html = await res.text();
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('rejects a code without a matching state cookie (login CSRF)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await upstoxCallback(
      new NextRequest('http://localhost/api/auth/callback/upstox?code=attacker-code&state=forged')
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('state mismatch');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('login redirect sets a state cookie and passes the same state to Upstox', async () => {
    vi.stubEnv('UPSTOX_CLIENT_ID', 'test-client-id');
    const res = await upstoxLogin(new NextRequest('http://localhost/api/auth/upstox'));
    const location = new URL(res.headers.get('location')!);
    const state = location.searchParams.get('state');
    expect(state).toMatch(/^[0-9a-f]{48}$/);
    expect(res.cookies.get(UPSTOX_STATE_COOKIE)?.value).toBe(state);
  });
});
