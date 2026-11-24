import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  sanitizeObject,
  isValidPan,
  isValidEmail,
  isValidDemat,
  isValidUpi,
  sanitizeSearchQuery,
} from '@/lib/security/sanitize';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { isAllowedOrigin } from '@/lib/security/cors';
import { validateSignInCredentials, registeredUsersStore } from '@/services/authStore';
import { validateSession } from '@/lib/security/session';

describe('Security Hardening Suite', () => {
  describe('Input Sanitization & XSS Defense', () => {
    it('should strip script tags and escape dangerous HTML characters', () => {
      const malicious = '<script>alert("XSS")</script>Hello World';
      const cleaned = sanitizeString(malicious);
      expect(cleaned).not.toContain('<script>');
      expect(cleaned).not.toContain('</script>');
      expect(cleaned).toContain('Hello World');
    });

    it('should strip event handlers like onerror and onload', () => {
      const malicious = '<img src="x" onerror="stealCookies()" />Normal Text';
      const cleaned = sanitizeString(malicious);
      expect(cleaned).not.toContain('onerror');
      expect(cleaned).not.toContain('stealCookies()');
    });

    it('should neutralize javascript: pseudo-protocols', () => {
      const malicious = 'javascript:alert(1)';
      const cleaned = sanitizeString(malicious);
      expect(cleaned).not.toContain('javascript:');
    });

    it('should sanitize nested objects and arrays recursively', () => {
      const payload = {
        name: '<b>Arjun</b>',
        tags: ['<script>bad()</script>', 'legitimate'],
        nested: {
          comment: '<iframe src="evil.com"></iframe>Clean comment',
        },
      };
      const cleaned = sanitizeObject(payload, true);
      expect(cleaned.name).not.toContain('<b>');
      expect(cleaned.tags[0]).not.toContain('<script>');
      expect(cleaned.nested.comment).not.toContain('<iframe>');
      expect(cleaned.nested.comment).toContain('Clean comment');
    });

    it('should validate PAN format accurately', () => {
      expect(isValidPan('ABCDE1234F')).toBe(true);
      expect(isValidPan('AAAPM1234F')).toBe(true);
      expect(isValidPan('12345ABCDE')).toBe(false);
      expect(isValidPan('ABCDE1234')).toBe(false);
      expect(isValidPan('')).toBe(false);
    });

    it('should validate email format accurately', () => {
      expect(isValidEmail('user@ipolens.in')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
    });

    it('should sanitize search queries against injection attacks', () => {
      const query = "'; DROP TABLE users; -- <script>";
      const cleaned = sanitizeSearchQuery(query);
      expect(cleaned).not.toContain(';');
      expect(cleaned).not.toContain('<script>');
    });
  });

  describe('Sliding-Window Rate Limiter', () => {
    it('should allow requests up to the tier limit and block once exceeded', () => {
      const testIp = '192.168.100.50';
      // Auth tier allows 10 requests
      for (let i = 0; i < 10; i++) {
        const res = checkRateLimit(testIp, 'auth');
        expect(res.allowed).toBe(true);
      }

      // 11th request should be blocked
      const blocked = checkRateLimit(testIp, 'auth');
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.resetSeconds).toBeGreaterThan(0);
    });
  });

  describe('CORS Origin Filtering', () => {
    it('should allow trusted origins and reject untrusted third parties', () => {
      expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
      expect(isAllowedOrigin('https://app.ipolens.in')).toBe(true);
      expect(isAllowedOrigin('https://malicious-attacker.com')).toBe(false);
      expect(isAllowedOrigin(null)).toBe(true); // Server-to-server / non-browser requests
    });
  });

  describe('Password Hashing & Constant-Time Verification', () => {
    it('should authenticate demo user with correct salted password', () => {
      const result = validateSignInCredentials({
        email: 'priya.sharma@investor.in',
        password: 'DemoPass123!',
      });
      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('priya.sharma@investor.in');
    });

    it('should reject incorrect password', () => {
      const result = validateSignInCredentials({
        email: 'priya.sharma@investor.in',
        password: 'WrongPassword!',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Incorrect password');
    });

    it('should never accept plaintext password without salt', () => {
      const user = registeredUsersStore.find((u) => u.email === 'priya.sharma@investor.in');
      expect(user?.passwordSalt).toBeDefined();
      expect(user?.passwordHash).not.toBe('DemoPass123!');
    });
  });

  describe('Session Spoofing Defense', () => {
    it('should reject forged jwt_session_<userId> tokens', async () => {
      const forgedToken = 'jwt_session_usr_inst_01';
      const userId = await validateSession(forgedToken);
      expect(userId).toBeNull();
    });

    it('should reject non-existent random tokens', async () => {
      const fakeToken = 'sess_invalid_token_1234567890';
      const userId = await validateSession(fakeToken);
      expect(userId).toBeNull();
    });
  });
});
