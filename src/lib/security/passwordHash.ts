import crypto from 'crypto';

/**
 * Enterprise Password Hashing Service using PBKDF2 with SHA-512
 * 100,000 iterations, 64-byte salt, constant-time verification.
 */

export interface HashedPasswordResult {
  hash: string;
  salt: string;
}

const ITERATIONS = 100000;
const KEY_LEN = 64;
const DIGEST = 'sha512';

/**
 * Hash a plain text password with a newly generated cryptographically secure salt.
 */
export function hashPassword(password: string): HashedPasswordResult {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
  return { hash, salt };
}

/**
 * Verify a plain text password against a stored hash and salt using constant-time comparison.
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  if (!password || !storedHash || !salt) return false;
  try {
    const computedHash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    const computedBuf = Buffer.from(computedHash, 'hex');
    if (storedBuf.length !== computedBuf.length) return false;
    return crypto.timingSafeEqual(storedBuf, computedBuf);
  } catch {
    return false;
  }
}
