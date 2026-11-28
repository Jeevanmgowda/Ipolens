import crypto from 'crypto';
import { demoAccountsEnabled } from '../lib/security/guards';
import { User, SignInCredentials, SignUpCredentials, GoogleAuthPayload } from '../types/auth';
import { isValidEmail } from '../lib/security/sanitize';
import { isValidPan } from './duplicateEnforcer';
import { hashPassword, verifyPassword } from '../lib/security/passwordHash';
import { hashPanForLookup, isRawPan, maskPan } from '../lib/security/panEncryption';
import { db, isPostgresConfigured, schema } from '../db';

export interface RegisteredUserRecord extends User {
  passwordHash: string;
  passwordSalt?: string;
  /** Server-only HMAC of the primary PAN; `primaryPan` itself is stored masked. */
  primaryPanHash?: string;
}

/** Masks a raw PAN and computes its lookup hash (docs/security/AUDIT_2026-11-27.md, M8). */
function securePrimaryPan(raw?: string): { primaryPan?: string; primaryPanHash?: string } {
  if (!raw) return { primaryPan: undefined, primaryPanHash: undefined };
  const clean = raw.trim().toUpperCase();
  if (isRawPan(clean)) return { primaryPan: maskPan(clean), primaryPanHash: hashPanForLookup(clean) };
  return { primaryPan: clean, primaryPanHash: undefined };
}

/**
 * The only shape of a user that may leave the server: an explicit allowlist, so
 * password hashes, salts and PAN hashes can never be returned by accident (L5).
 * A raw primary PAN (e.g. a legacy DB row) is masked on the way out (M8).
 */
export function toPublicUser(record: User & Partial<RegisteredUserRecord>): User {
  const primaryPan = record.primaryPan && isRawPan(record.primaryPan) ? maskPan(record.primaryPan) : record.primaryPan;
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    avatarUrl: record.avatarUrl,
    role: record.role,
    investorCategory: record.investorCategory,
    primaryPan,
    panCount: record.panCount,
    dematCount: record.dematCount,
    createdAt: record.createdAt,
  };
}

/**
 * HMAC of the user's primary PAN. Only in-memory accounts carry it: the users
 * table has no hash column yet (schema changes are pending on the Supabase
 * branch), so database-only accounts must add their own PAN as a "Self" family
 * profile to use the allotment check.
 */
export function getPrimaryPanHash(userId: string): string | undefined {
  return registeredUsersStore.find((u) => u.id === userId)?.primaryPanHash;
}

/**
 * Demo accounts (including a demo admin) exist only outside production.
 * Their password is published in the test suite, so they must never be live in a
 * production deployment (audit H11). Production admins are not seeded from code.
 */
export function isDemoAccountsEnabled(): boolean {
  // Off in production; ALLOW_DEMO_ACCOUNTS=false also turns them off in development.
  return demoAccountsEnabled();
}

// Demo accounts (cryptographically hashed with PBKDF2-SHA512)
const DEMO_USER_RECORDS: RegisteredUserRecord[] = [
  {
    id: 'usr_admin_00',
    name: 'Security Admin',
    email: 'admin@ipolens.in',
    passwordHash: 'aa54538cd1b24c58d73cf56e567d3c5740cfd5e295756db865fd70e60783b1ea55d0fd62d3243e1b319f321dc5d75be552594702da9f3b4d29acac2833b2f747',
    passwordSalt: 'c3d4e5f6a1b20718293a4b5c6d7e8f901234567890abcdef1234567890abcdef',
    role: 'admin',
    investorCategory: 'Institutional',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_inst_01',
    name: 'Arjun Mehta',
    email: 'arjun.mehta@ipolens.in',
    passwordHash: '2f3360643609755e5f4ba23eace7d7bf3b0cfa3b3445af9e80c67819583884c9e5807853f71f585c6a5611ba0287bf2f2a20a12d43da5bf246330eff3fdf6e5c',
    passwordSalt: 'a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef',
    role: 'institutional',
    investorCategory: 'bNII',
    primaryPan: 'AAAPM1234F',
    panCount: 6,
    dematCount: 4,
    createdAt: '2025-01-15T00:00:00.000Z',
  },
  {
    id: 'usr_ret_02',
    name: 'Priya Sharma',
    email: 'priya.sharma@investor.in',
    passwordHash: 'ccb95c8298bb48538519a5b59b94235f9260d1f1eac5413a320ee86ffe06b8694705f6a4a5070fea9c9709ef9ce5f9ccc211436a2b0adbaf2d0be8cb210f1a30',
    passwordSalt: 'b2c3d4e5f6a10718293a4b5c6d7e8f901234567890abcdef1234567890abcdef',
    role: 'retail',
    investorCategory: 'Retail',
    primaryPan: 'ABFPS5678K',
    panCount: 3,
    dematCount: 2,
    createdAt: '2025-03-01T00:00:00.000Z',
  },
];

// In-memory user store, seeded with the demo accounts only outside production.
export const registeredUsersStore: RegisteredUserRecord[] = isDemoAccountsEnabled()
  ? DEMO_USER_RECORDS.map((u) => ({ ...u, ...securePrimaryPan(u.primaryPan) }))
  : [];

// One message for unknown email and wrong password, so sign-in does not reveal
// which emails have accounts (docs/security/AUDIT_2026-11-27.md, M2).
export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';
let dummyCredential: { hash: string; salt: string } | null = null;
function getDummyCredential(): { hash: string; salt: string } {
  if (!dummyCredential) dummyCredential = hashPassword(crypto.randomBytes(16).toString('hex'));
  return dummyCredential;
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234', 'passw0rd', 'p@ssw0rd', 'p@ssword',
  '123456', '1234567', '12345678', '123456789', '1234567890', '0123456789', 'qwerty', 'qwerty123', 'qwertyuiop',
  'abc123', 'abcd1234', 'iloveyou', 'admin', 'admin123', 'administrator', 'welcome', 'welcome1', 'welcome123',
  'letmein', 'monkey', 'dragon', 'sunshine', 'princess', 'football', 'baseball', 'superman', 'trustno1',
  'india123', 'india@123', 'bharat123', 'ipolens', 'ipolens123', 'changeme', 'default', 'secret', 'test1234',
]);

/** Returns a policy violation message, or null when the password is acceptable. */
export function passwordPolicyError(password: string, email?: string): string | null {
  if (!password || password.length < 10) return 'Password must be at least 10 characters long.';
  if (password.length > 128) return 'Password must be at most 128 characters long.';
  const normalized = password.toLowerCase().replace(/[^a-z0-9@]+$/g, '');
  if (COMMON_PASSWORDS.has(normalized) || COMMON_PASSWORDS.has(password.toLowerCase())) {
    return 'This password is too common. Choose a less predictable one.';
  }
  const local = (email || '').split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) {
    return 'Password must not contain your email address.';
  }
  return null;
}

const INVESTOR_CATEGORIES: ReadonlySet<string> = new Set(['Retail', 'sNII', 'bNII', 'Institutional']);

/** Client-chosen category, restricted to known values (audit M5); unknown values become Retail. */
function normalizeInvestorCategory(value: unknown): User['investorCategory'] {
  return typeof value === 'string' && INVESTOR_CATEGORIES.has(value) ? (value as User['investorCategory']) : 'Retail';
}

export function validateSignInCredentials(creds: SignInCredentials): { valid: boolean; error?: string; user?: User } {
  const { email, password } = creds;
  if (!email || !email.trim()) {
    return { valid: false, error: 'Email address is required.' };
  }
  if (!password) {
    return { valid: false, error: 'Password is required.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = registeredUsersStore.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (!existingUser) {
    // Same PBKDF2 cost as a real check so response time does not reveal the account.
    const dummy = getDummyCredential();
    verifyPassword(password.slice(0, 128), dummy.hash, dummy.salt);
    return { valid: false, error: INVALID_CREDENTIALS_MESSAGE };
  }

  // Cryptographic constant-time verification using salted PBKDF2-SHA512
  if (!existingUser.passwordSalt || !existingUser.passwordHash) {
    return { valid: false, error: 'Account credentials must be reset.' };
  }

  const passwordMatches = verifyPassword(password, existingUser.passwordHash, existingUser.passwordSalt);

  if (!passwordMatches) {
    return { valid: false, error: INVALID_CREDENTIALS_MESSAGE };
  }

  // Strip passwordHash and passwordSalt before returning
  return { valid: true, user: toPublicUser(existingUser) };
}

export function validateAndRegisterUser(creds: SignUpCredentials): { valid: boolean; error?: string; user?: User } {
  const { name, email, password, primaryPan, termsAccepted } = creds;
  const investorCategory = normalizeInvestorCategory(creds.investorCategory);

  if (!name || name.trim().length < 2) {
    return { valid: false, error: 'Full name must be at least 2 characters.' };
  }

  if (name.trim().length > 100) {
    return { valid: false, error: 'Full name must be at most 100 characters.' };
  }

  if (!email || !isValidEmail(email.trim())) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }

  const passwordProblem = passwordPolicyError(password, email);
  if (passwordProblem) {
    return { valid: false, error: passwordProblem };
  }

  if (!termsAccepted) {
    return { valid: false, error: 'You must accept the terms of service and SEBI disclosures.' };
  }

  if (primaryPan && primaryPan.trim()) {
    if (!isValidPan(primaryPan.trim())) {
      return { valid: false, error: 'Invalid PAN format. PAN must be 10 characters (e.g. ABCDE1234F).' };
    }
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = registeredUsersStore.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (existing) {
    return { valid: false, error: 'An account with this email address already exists. Please sign in.' };
  }

  const role = investorCategory === 'Institutional' ? 'institutional' : investorCategory === 'bNII' || investorCategory === 'sNII' ? 'hni' : 'retail';

  // Securely hash password with cryptographically secure salt & PBKDF2 (100k rounds)
  const { hash, salt } = hashPassword(password);

  const newUser: RegisteredUserRecord = {
    id: `usr_${crypto.randomUUID()}`,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: hash,
    passwordSalt: salt,
    role,
    investorCategory: investorCategory || 'Retail',
    ...securePrimaryPan(primaryPan),
    panCount: primaryPan ? 1 : 0,
    dematCount: 0,
    createdAt: new Date().toISOString(),
  };

  registeredUsersStore.push(newUser);

  // Synchronize to PostgreSQL if configured
  if (isPostgresConfigured && db) {
    try {
      db.insert(schema.usersTable).values({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        passwordHash: hash,
        salt,
        role: newUser.role,
        investorCategory: newUser.investorCategory || 'Retail',
        primaryPan: newUser.primaryPan,
        createdAt: new Date(newUser.createdAt),
      }).then(() => {}).catch((e: any) => console.warn('[AuthStore] Error syncing user to DB:', e));
    } catch (e) {
      console.warn('[AuthStore] Notice inserting user to DB:', e);
    }
  }

  return { valid: true, user: toPublicUser(newUser) };
}

export function registerOrLoginWithGoogle(googleData: GoogleAuthPayload): { valid: boolean; error?: string; user?: User } {
  const { email, name, avatarUrl, investorCategory, primaryPan } = googleData;

  if (!email || !isValidEmail(email.trim())) {
    return { valid: false, error: 'A valid Google account email is required.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = registeredUsersStore.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (existingUser) {
    if (avatarUrl && !existingUser.avatarUrl) {
      existingUser.avatarUrl = avatarUrl;
    }
    return { valid: true, user: toPublicUser(existingUser) };
  }

  if (primaryPan && primaryPan.trim()) {
    if (!isValidPan(primaryPan.trim())) {
      return { valid: false, error: 'Invalid PAN format. PAN must be 10 characters (e.g. ABCDE1234F).' };
    }
  }

  const category = normalizeInvestorCategory(investorCategory);
  const role =
    category === 'Institutional'
      ? 'institutional'
      : category === 'bNII' || category === 'sNII'
      ? 'hni'
      : 'retail';

  const { hash, salt } = hashPassword(crypto.randomBytes(32).toString('hex'));

  const newUser: RegisteredUserRecord = {
    id: `usr_g_${crypto.randomUUID()}`,
    name: name?.trim() || email.split('@')[0],
    email: normalizedEmail,
    avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || email)}`,
    passwordHash: hash,
    passwordSalt: salt,
    role,
    investorCategory: category,
    ...securePrimaryPan(primaryPan),
    panCount: primaryPan ? 1 : 0,
    dematCount: 0,
    createdAt: new Date().toISOString(),
  };

  registeredUsersStore.push(newUser);
  return { valid: true, user: toPublicUser(newUser) };
}
