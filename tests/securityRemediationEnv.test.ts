import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * Production-environment checks for R5 (H11) and R6 (H8), docs/security/AUDIT_2026-11-27.md.
 * Kept in their own file because they reset the module registry.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('R5 / H11: demo accounts are never seeded in production', () => {
  it('seeds no users (and no admin) when NODE_ENV=production', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    const mod = await import('@/services/authStore');
    expect(mod.isDemoAccountsEnabled()).toBe(false);
    expect(mod.registeredUsersStore).toHaveLength(0);
    vi.resetModules();
  });
});

describe('R6 / H8: PAN encryption key is mandatory in production', () => {
  it('refuses to encrypt without PAN_ENCRYPTION_KEY (no DATABASE_URL / constant fallback)', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PAN_ENCRYPTION_KEY', '');
    vi.stubEnv('NEXTAUTH_SECRET', '');
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@db.example/ipolens');
    const { encryptPan } = await import('@/lib/security/panEncryption');
    expect(() => encryptPan('ABCDE1234F')).toThrow(/PAN_ENCRYPTION_KEY/);
    vi.resetModules();
  });

  it('round-trips when a key is configured', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PAN_ENCRYPTION_KEY', 'test-key-for-round-trip');
    const { encryptPan, decryptPan } = await import('@/lib/security/panEncryption');
    expect(decryptPan(encryptPan('abcde1234f'))).toBe('ABCDE1234F');
    vi.resetModules();
  });
});
