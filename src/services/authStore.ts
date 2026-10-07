import { User, SignInCredentials, SignUpCredentials, GoogleAuthPayload } from '../types/auth';
import { isValidPan } from './duplicateEnforcer';
import { hashPassword, verifyPassword } from '../lib/security/passwordHash';
import { db, isPostgresConfigured, schema } from '../db';

export interface RegisteredUserRecord extends User {
  passwordHash: string;
  passwordSalt?: string;
}

// Initial registered users database seeded with default demo accounts
export const registeredUsersStore: RegisteredUserRecord[] = [
  {
    id: 'usr_inst_01',
    name: 'Arjun Mehta',
    email: 'arjun.mehta@ipolens.in',
    passwordHash: 'DemoPass123!',
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
    passwordHash: 'DemoPass123!',
    role: 'retail',
    investorCategory: 'Retail',
    primaryPan: 'ABFPS5678K',
    panCount: 3,
    dematCount: 2,
    createdAt: '2025-03-01T00:00:00.000Z',
  },
];

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
    return { valid: false, error: 'No account found with this email address.' };
  }

  // Check password: either via salted PBKDF2 hash or plaintext match for demo seeds
  let passwordMatches = false;
  if (existingUser.passwordSalt) {
    passwordMatches = verifyPassword(password, existingUser.passwordHash, existingUser.passwordSalt);
  } else {
    passwordMatches = existingUser.passwordHash === password;
  }

  if (!passwordMatches) {
    return { valid: false, error: 'Incorrect password. Please try again.' };
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

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }

  if (!password || password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters long.' };
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
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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

  const { passwordHash: _, passwordSalt: __, ...safeUser } = newUser;
  return { valid: true, user: safeUser };
}

export function registerOrLoginWithGoogle(googleData: GoogleAuthPayload): { valid: boolean; error?: string; user?: User } {
  const { email, name, avatarUrl, investorCategory, primaryPan } = googleData;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
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

  const { hash, salt } = hashPassword(`google_oauth_${Date.now()}_${Math.random()}`);

  const newUser: RegisteredUserRecord = {
    id: `usr_g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
