import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { User, SignInCredentials, SignUpCredentials, GoogleAuthPayload } from '@/types/auth';
import { isValidPan } from './duplicateEnforcer';
import { hashPassword, verifyPassword } from '@/lib/security/passwordHash';
import { db, isDatabaseActive, isPostgresConfigured, reportDatabaseFailure, schema } from '@/db';
import { isValidEmail } from '@/lib/security/sanitize';

export interface RegisteredUserRecord extends User {
  passwordHash: string;
  passwordSalt?: string;
}

/**
 * Demo accounts (and the one-click demo login) are available outside production,
 * or in production only when ENABLE_DEMO_LOGIN=true is set explicitly.
 * Their password is published in the test suite, so they must never be live by default.
 */
export function isDemoLoginEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEMO_LOGIN === 'true';
}

if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build' && !isPostgresConfigured) {
  console.error(
    '[AuthStore] DATABASE_URL is not configured in production. User accounts and sessions are held in memory only ' +
      'and will be lost on every restart or serverless cold start.'
  );
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

// In-memory user cache. Seeded with demo accounts only when demo login is enabled.
export const registeredUsersStore: RegisteredUserRecord[] = isDemoLoginEnabled() ? [...DEMO_USER_RECORDS] : [];

export function newUserId(prefix: 'usr' | 'usr_g'): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

/**
 * Ensures the user with this email is in the in-memory cache, loading it from
 * PostgreSQL when configured. Call before the synchronous validate/register
 * functions so accounts survive restarts.
 */
export async function loadUserFromDatabase(email: string | undefined): Promise<void> {
  if (!email || !isDatabaseActive() || !db) return;
  const normalizedEmail = email.trim().toLowerCase();
  if (registeredUsersStore.some((u) => u.email.toLowerCase() === normalizedEmail)) return;

  try {
    const rows = await db
      .select()
      .from(schema.usersTable)
      .where(eq(schema.usersTable.email, normalizedEmail))
      .limit(1);
    const r = rows[0];
    if (!r || registeredUsersStore.some((u) => u.id === r.id)) return;
    registeredUsersStore.push({
      id: r.id,
      name: r.name,
      email: r.email,
      passwordHash: r.passwordHash,
      passwordSalt: r.salt,
      role: r.role as User['role'],
      investorCategory: r.investorCategory as User['investorCategory'],
      primaryPan: r.primaryPan || undefined,
      avatarUrl: r.avatarUrl || undefined,
      createdAt: r.createdAt.toISOString(),
    });
  } catch (err) {
    reportDatabaseFailure('loading user by email', err);
  }
}

/**
 * Persists a user from the in-memory cache to PostgreSQL (no-op if it already exists).
 */
export async function persistUser(userId: string): Promise<void> {
  if (!isDatabaseActive() || !db) return;
  const user = registeredUsersStore.find((u) => u.id === userId);
  if (!user) return;

  try {
    await db
      .insert(schema.usersTable)
      .values({
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        salt: user.passwordSalt || '',
        role: user.role,
        investorCategory: user.investorCategory || 'Retail',
        primaryPan: user.primaryPan,
        avatarUrl: user.avatarUrl,
        createdAt: new Date(user.createdAt),
      })
      .onConflictDoNothing();
  } catch (err) {
    reportDatabaseFailure('saving user to DB', err);
  }
}

// One message for unknown email and wrong password, so sign-in does not reveal
// which emails have accounts (docs/security/BASELINE_AUDIT.md, M2).
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
  const { passwordHash: _, passwordSalt: __, ...safeUser } = existingUser;
  return { valid: true, user: safeUser };
}

export function validateAndRegisterUser(creds: SignUpCredentials): { valid: boolean; error?: string; user?: User } {
  const { name, email, password, investorCategory, primaryPan, termsAccepted } = creds;

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
    id: newUserId('usr'),
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: hash,
    passwordSalt: salt,
    role,
    investorCategory: investorCategory || 'Retail',
    primaryPan: primaryPan ? primaryPan.trim().toUpperCase() : undefined,
    panCount: primaryPan ? 1 : 0,
    dematCount: 0,
    createdAt: new Date().toISOString(),
  };

  registeredUsersStore.push(newUser);

  const { passwordHash: _, passwordSalt: __, ...safeUser } = newUser;
  return { valid: true, user: safeUser };
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
    const { passwordHash: _, passwordSalt: __, ...safeUser } = existingUser;
    return { valid: true, user: safeUser };
  }

  if (primaryPan && primaryPan.trim()) {
    if (!isValidPan(primaryPan.trim())) {
      return { valid: false, error: 'Invalid PAN format. PAN must be 10 characters (e.g. ABCDE1234F).' };
    }
  }

  const category = investorCategory || 'Retail';
  const role =
    category === 'Institutional'
      ? 'institutional'
      : category === 'bNII' || category === 'sNII'
      ? 'hni'
      : 'retail';

  const { hash, salt } = hashPassword(crypto.randomBytes(32).toString('hex'));

  const newUser: RegisteredUserRecord = {
    id: newUserId('usr_g'),
    name: name?.trim() || email.split('@')[0],
    email: normalizedEmail,
    avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || email)}`,
    passwordHash: hash,
    passwordSalt: salt,
    role,
    investorCategory: category,
    primaryPan: primaryPan ? primaryPan.trim().toUpperCase() : undefined,
    panCount: primaryPan ? 1 : 0,
    dematCount: 0,
    createdAt: new Date().toISOString(),
  };

  registeredUsersStore.push(newUser);
  const { passwordHash: _, passwordSalt: __, ...safeUser } = newUser;
  return { valid: true, user: safeUser };
}
