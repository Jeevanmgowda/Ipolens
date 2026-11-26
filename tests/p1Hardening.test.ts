import { describe, it, expect, afterEach, vi } from 'vitest';

function demoRequest(type: string): Request {
  return new Request('http://localhost/api/auth/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('Demo accounts and demo login', () => {
  it('issues a real HttpOnly session for a demo account outside production', async () => {
    const { POST } = await import('@/app/api/auth/demo/route');
    const res = await POST(demoRequest('retail'));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.user.email).toBe('priya.sharma@investor.in');
    expect(json.user.passwordHash).toBeUndefined();
    expect(res.headers.get('set-cookie')).toMatch(/ipolens_session=sess_.*HttpOnly/i);
  });

  it('rejects unknown demo account types', async () => {
    const { POST } = await import('@/app/api/auth/demo/route');
    expect((await POST(demoRequest('admin'))).status).toBe(400);
  });

  it('disables demo login and demo seed accounts in production by default', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ENABLE_DEMO_LOGIN', '');
    const { POST } = await import('@/app/api/auth/demo/route');
    const { registeredUsersStore, validateSignInCredentials } = await import('@/lib/services/authStore');

    expect((await POST(demoRequest('retail'))).status).toBe(403);
    expect(registeredUsersStore).toHaveLength(0);
    expect(validateSignInCredentials({ email: 'priya.sharma@investor.in', password: 'DemoPass123!' }).valid).toBe(false);
  });

  it('allows demo login in production only when ENABLE_DEMO_LOGIN=true', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ENABLE_DEMO_LOGIN', 'true');
    const { POST } = await import('@/app/api/auth/demo/route');
    expect((await POST(demoRequest('institutional'))).status).toBe(200);
  });
});

describe('User IDs', () => {
  it('generates unguessable UUID-based user IDs', async () => {
    const { validateAndRegisterUser } = await import('@/lib/services/authStore');
    const res = validateAndRegisterUser({
      name: 'Uuid Tester',
      email: `uuid.tester.${Date.now()}@example.com`,
      password: 'StrongPass123!',
      termsAccepted: true,
    } as Parameters<typeof validateAndRegisterUser>[0]);
    expect(res.user?.id).toMatch(/^usr_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('Database hooks without a database', () => {
  it('loadUserFromDatabase and persistUser are safe no-ops', async () => {
    const { loadUserFromDatabase, persistUser } = await import('@/lib/services/authStore');
    await expect(loadUserFromDatabase('nobody@example.com')).resolves.toBeUndefined();
    await expect(persistUser('usr_missing')).resolves.toBeUndefined();
  });
});

describe('Distributed rate limiter', () => {
  it('falls back to the in-memory limiter when Redis is not available', async () => {
    const { checkRateLimitDistributed } = await import('@/lib/security/rateLimiter');
    const ip = `10.9.8.${Math.floor(Math.random() * 200)}`;
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await checkRateLimitDistributed(ip, 'scraper'));
    expect(results.slice(0, 5).every((r) => r.allowed)).toBe(true);
    expect(results[5].allowed).toBe(false);
  });
});
