import { describe, it, expect } from 'vitest';
import {
  validateSignInCredentials,
  validateAndRegisterUser,
  registerOrLoginWithGoogle,
  registeredUsersStore,
} from '../src/services/authStore';

describe('Auth Service & Validation', () => {
  describe('validateSignInCredentials', () => {
    it('rejects empty email', () => {
      const result = validateSignInCredentials({ email: '', password: 'password123' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Email address is required');
    });

    it('rejects empty password', () => {
      const result = validateSignInCredentials({ email: 'test@example.com', password: '' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Password is required');
    });

    it('rejects unregistered email', () => {
      const result = validateSignInCredentials({
        email: 'nonexistent@ipolens.in',
        password: 'password123',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No account found');
    });

    it('rejects wrong password', () => {
      const result = validateSignInCredentials({
        email: 'arjun.mehta@ipolens.in',
        password: 'WrongPassword!',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Incorrect password');
    });

    it('authenticates demo user with valid credentials', () => {
      const result = validateSignInCredentials({
        email: 'arjun.mehta@ipolens.in',
        password: 'DemoPass123!',
      });
      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('arjun.mehta@ipolens.in');
      expect(result.user?.name).toBe('Arjun Mehta');
      expect(result.user?.role).toBe('institutional');
      // Ensure password hash is not exposed
      expect((result.user as any)?.passwordHash).toBeUndefined();
    });
  });

  describe('validateAndRegisterUser', () => {
    it('rejects short or empty names', () => {
      const result = validateAndRegisterUser({
        name: 'A',
        email: 'valid@example.com',
        password: 'Password123!',
        investorCategory: 'Retail',
        termsAccepted: true,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Full name must be at least 2 characters');
    });

    it('rejects invalid email formats', () => {
      const result = validateAndRegisterUser({
        name: 'John Doe',
        email: 'invalid-email',
        password: 'Password123!',
        investorCategory: 'Retail',
        termsAccepted: true,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('valid email address');
    });

    it('rejects passwords shorter than 6 characters', () => {
      const result = validateAndRegisterUser({
        name: 'John Doe',
        email: 'valid@example.com',
        password: '123',
        investorCategory: 'Retail',
        termsAccepted: true,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Password must be at least 6 characters');
    });

    it('rejects when terms are not accepted', () => {
      const result = validateAndRegisterUser({
        name: 'John Doe',
        email: 'valid@example.com',
        password: 'Password123!',
        investorCategory: 'Retail',
        termsAccepted: false,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('You must accept the terms of service');
    });

    it('rejects invalid PAN format', () => {
      const result = validateAndRegisterUser({
        name: 'John Doe',
        email: 'valid@example.com',
        password: 'Password123!',
        investorCategory: 'Retail',
        primaryPan: 'INVALID_PAN',
        termsAccepted: true,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid PAN format');
    });

    it('successfully registers a new user with valid details and assigns role', () => {
      const uniqueEmail = `test_user_${Date.now()}@ipolens.in`;
      const result = validateAndRegisterUser({
        name: 'Vikram Seth',
        email: uniqueEmail,
        password: 'SecurePassword123!',
        investorCategory: 'bNII',
        primaryPan: 'abcde1234f',
        termsAccepted: true,
      });

      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.name).toBe('Vikram Seth');
      expect(result.user?.email).toBe(uniqueEmail.toLowerCase());
      expect(result.user?.role).toBe('hni');
      expect(result.user?.primaryPan).toBe('ABCDE1234F'); // Uppercased
      expect(result.user?.panCount).toBe(1);

      // Now verify that registering again with the same email fails
      const duplicateResult = validateAndRegisterUser({
        name: 'Vikram Duplicate',
        email: uniqueEmail,
        password: 'SecurePassword123!',
        investorCategory: 'bNII',
        termsAccepted: true,
      });
      expect(duplicateResult.valid).toBe(false);
      expect(duplicateResult.error).toContain('already exists');
    });
  });

  describe('registerOrLoginWithGoogle', () => {
    it('rejects invalid or empty Google emails', () => {
      const res1 = registerOrLoginWithGoogle({ email: '', name: 'Test User' });
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('email is required');

      const res2 = registerOrLoginWithGoogle({ email: 'invalid-email', name: 'Test User' });
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain('email is required');
    });

    it('creates a new user account with Google profile details', () => {
      const gEmail = `google_user_${Date.now()}@gmail.com`;
      const res = registerOrLoginWithGoogle({
        email: gEmail,
        name: 'Jeevan Gowda',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
        investorCategory: 'Retail',
        primaryPan: 'ABCDE1234F',
      });

      expect(res.valid).toBe(true);
      expect(res.user).toBeDefined();
      expect(res.user?.email).toBe(gEmail.toLowerCase());
      expect(res.user?.name).toBe('Jeevan Gowda');
      expect(res.user?.role).toBe('retail');
      expect(res.user?.primaryPan).toBe('ABCDE1234F');
      expect(res.user?.panCount).toBe(1);
    });

    it('authenticates existing user when signing in with Google', () => {
      const gEmail = 'arjun.mehta@ipolens.in'; // Already in seed store
      const res = registerOrLoginWithGoogle({
        email: gEmail,
        name: 'Arjun Mehta',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      });

      expect(res.valid).toBe(true);
      expect(res.user).toBeDefined();
      expect(res.user?.email).toBe('arjun.mehta@ipolens.in');
      expect(res.user?.role).toBe('institutional');
    });
  });
});
