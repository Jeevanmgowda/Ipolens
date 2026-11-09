import { describe, it, expect } from 'vitest';
import {
  checkTokenValidity,
  generateTotp,
  readEnvConfig,
  parseEnvVal,
} from '../scripts/getUpstoxToken.mjs';

function createMockJwt(sub: string, exp: number, iat: number = exp - 86400): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({ sub, exp, iat, iss: 'upstox' })).toString('base64');
  const signature = 'mock_signature_hash_bytes';
  return `${header}.${payload}.${signature}`;
}

describe('Upstox Dev Runner & Token Lifecycle', () => {
  it('correctly identifies an active, valid JWT token', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 14400; // 4 hours in the future
    const token = createMockJwt('TEST_USER_123', futureExp);

    const result = checkTokenValidity({
      accessToken: token,
      clientId: 'mock_client',
      clientSecret: 'mock_sec',
    } as any);

    expect(result.valid).toBe(true);
    expect(result.account).toBe('TEST_USER_123');
    expect(Number(result.hoursLeft)).toBeGreaterThan(3.5);
    expect(result.secLeft).toBeGreaterThan(14000);
  });

  it('correctly flags an expired JWT token for refresh', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const token = createMockJwt('EXPIRED_USER', pastExp);

    const result = checkTokenValidity({
      accessToken: token,
      clientId: 'mock_client',
      clientSecret: 'mock_sec',
    } as any);

    expect(result.valid).toBe(false);
    expect(result.account).toBe('EXPIRED_USER');
    expect(result.reason).toContain('Token expired at');
  });

  it('handles missing, placeholder, or truncated access tokens gracefully', () => {
    expect(checkTokenValidity({ accessToken: '' } as any).valid).toBe(false);
    expect(checkTokenValidity({ accessToken: 'your_token_here' } as any).valid).toBe(false);
    expect(checkTokenValidity({ accessToken: 'too_short' } as any).valid).toBe(false);
  });

  it('generates standard RFC 6238 6-digit TOTP codes', () => {
    // Standard RFC test secret: JBSWY3DPEHPK3PXP
    const totp = generateTotp('JBSWY3DPEHPK3PXP');
    expect(totp).toMatch(/^\d{6}$/);
    expect(totp.length).toBe(6);
  });

  it('correctly parses environment string values with quotes and comments', () => {
    expect(parseEnvVal('"my_secret_token"')).toBe('my_secret_token');
    expect(parseEnvVal("'another_secret'")).toBe('another_secret');
    expect(parseEnvVal('unquoted_val # some comment')).toBe('unquoted_val');
  });
});

