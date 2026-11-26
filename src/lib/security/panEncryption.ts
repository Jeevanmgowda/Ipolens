import crypto from 'crypto';

/**
 * Enterprise PAN Encryption & Masking Service (AES-256-GCM)
 * Compliant with SEBI privacy guidelines & Indian Digital Personal Data Protection (DPDP) Act.
 */

// Secret encryption key derived from environment.
// Resolved lazily so `next build` (which runs with NODE_ENV=production) does not
// fail when secrets are only present at runtime.
const DEV_ONLY_KEY = 'ipolens_dev_safe_encryption_key_2025';
let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  const rawKey = process.env.PAN_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!rawKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PAN_ENCRYPTION_KEY must be set in production to encrypt PAN data.');
    }
    return crypto.createHash('sha256').update(DEV_ONLY_KEY).digest();
  }
  // Derive 32-byte key using sha256
  cachedKey = crypto.createHash('sha256').update(rawKey).digest();
  return cachedKey;
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Encrypts a raw 10-character PAN number using AES-256-GCM.
 * Output format: "iv:authTag:ciphertext" (all in hex).
 */
export function encryptPan(pan: string): string {
  const cleanPan = pan.trim().toUpperCase();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  let encrypted = cipher.update(cleanPan, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted PAN string.
 * Validates integrity via GCM authentication tag.
 */
export function decryptPan(encryptedPanPayload: string): string {
  if (!encryptedPanPayload || !encryptedPanPayload.includes(':')) {
    // If not encrypted (e.g. legacy plain text), return as is
    return encryptedPanPayload;
  }

  try {
    const parts = encryptedPanPayload.split(':');
    if (parts.length !== 3) {
      return encryptedPanPayload;
    }

    const [ivHex, authTagHex, cipherTextHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherTextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted.toUpperCase();
  } catch (err) {
    console.error('[PAN Security] Decryption error:', err);
    return '**********';
  }
}

/**
 * Mask a PAN according to SEBI & IT Department display standards.
 * Example: 'ABCDE1234F' -> 'ABCDE****F' (or 'XXXXXX1234F')
 */
export function maskPan(pan: string, style: 'sebi' | 'income_tax' = 'sebi'): string {
  if (!pan) return '**********';
  const clean = pan.trim().toUpperCase();
  if (clean.length !== 10) {
    return clean.slice(0, 2) + '******' + clean.slice(-2);
  }

  if (style === 'income_tax') {
    // Format: XXXXX1234F
    return 'XXXXX' + clean.slice(5);
  }

  // SEBI format: ABCDE****F (shows entity type letter, e.g. P for individual, H for HUF, C for Company)
  return clean.slice(0, 5) + '****' + clean.slice(9);
}

/**
 * Returns true if string matches standard Indian PAN format (5 letters, 4 digits, 1 letter)
 */
export function isValidPan(pan: string): boolean {
  if (!pan) return false;
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.trim().toUpperCase());
}
