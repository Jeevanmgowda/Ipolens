import { eq } from 'drizzle-orm';
import { User, SignInCredentials, SignUpCredentials, GoogleAuthPayload, InvestorCategory } from '../types/auth';
import { isValidPan } from '../lib/security/panEncryption';
import { hashPassword, verifyPassword } from '../lib/security/passwordHash';
import { getDb, schema } from '../db';

/**
 * Database-backed account store (Supabase `users` table). No seeded or demo accounts.
 */

type AuthResult = { valid: boolean; error?: string; user?: User };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function roleFor(category: InvestorCategory | undefined): User['role'] {
  if (category === 'Institutional') return 'institutional';
  if (category === 'bNII' || category === 'sNII') return 'hni';
  return 'retail';
}

export function toPublicUser(r: typeof schema.usersTable.$inferSelect): User {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role as User['role'],
    investorCategory: r.investorCategory as InvestorCategory,
    primaryPan: r.primaryPan || undefined,
    avatarUrl: r.avatarUrl || undefined,
    createdAt: r.createdAt.toISOString(),
  };
}

async function findByEmail(email: string) {
  const rows = await getDb()
    .select()
    .from(schema.usersTable)
    .where(eq(schema.usersTable.email, email.trim().toLowerCase()))
    .limit(1);
  return rows[0] || null;
}

export async function findUserById(id: string): Promise<User | null> {
  const rows = await getDb().select().from(schema.usersTable).where(eq(schema.usersTable.id, id)).limit(1);
  return rows[0] ? toPublicUser(rows[0]) : null;
}

export async function validateSignInCredentials(creds: SignInCredentials): Promise<AuthResult> {
  const { email, password } = creds;
  if (!email?.trim()) return { valid: false, error: 'Email address is required.' };
  if (!password) return { valid: false, error: 'Password is required.' };

  const row = await findByEmail(email);
  // Same message for unknown email and wrong password to prevent account enumeration.
  if (!row || !row.salt || !verifyPassword(password, row.passwordHash, row.salt)) {
    return { valid: false, error: 'Incorrect email or password.' };
  }
  return { valid: true, user: toPublicUser(row) };
}

export async function validateAndRegisterUser(creds: SignUpCredentials): Promise<AuthResult> {
  const { name, email, password, investorCategory, primaryPan, termsAccepted } = creds;

  if (!name || name.trim().length < 2) return { valid: false, error: 'Full name must be at least 2 characters.' };
  if (!email || !EMAIL_RE.test(email.trim())) return { valid: false, error: 'Please enter a valid email address.' };
  if (!password || password.length < 8) return { valid: false, error: 'Password must be at least 8 characters long.' };
  if (!termsAccepted) return { valid: false, error: 'You must accept the terms of service and SEBI disclosures.' };
  if (primaryPan?.trim() && !isValidPan(primaryPan)) {
    return { valid: false, error: 'Invalid PAN format. PAN must be 10 characters (e.g. ABCDE1234F).' };
  }

  if (await findByEmail(email)) {
    return { valid: false, error: 'An account with this email address already exists. Please sign in.' };
  }

  const { hash, salt } = hashPassword(password);
  const category = investorCategory || 'Retail';
  const [row] = await getDb()
    .insert(schema.usersTable)
    .values({
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: hash,
      salt,
      role: roleFor(category),
      investorCategory: category,
      primaryPan: primaryPan?.trim() ? primaryPan.trim().toUpperCase() : null,
    })
    .returning();
  return { valid: true, user: toPublicUser(row) };
}

interface GoogleIdTokenClaims {
  aud: string;
  iss: string;
  sub: string;
  email: string;
  email_verified: string | boolean;
  name?: string;
  picture?: string;
  exp: string;
}

/**
 * Verifies a Google Identity Services ID token with Google's tokeninfo endpoint and checks
 * audience, issuer, expiry and email verification. Never trust client-supplied email fields.
 */
export async function verifyGoogleIdToken(credential: string): Promise<GoogleIdTokenClaims> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('Google sign-in is not configured (NEXT_PUBLIC_GOOGLE_CLIENT_ID).');

  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error('Google credential could not be verified.');
  const claims = (await res.json()) as GoogleIdTokenClaims;

  if (claims.aud !== clientId) throw new Error('Google credential was issued for a different application.');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss)) {
    throw new Error('Google credential has an invalid issuer.');
  }
  if (Number(claims.exp) * 1000 < Date.now()) throw new Error('Google credential has expired.');
  if (!(claims.email_verified === true || claims.email_verified === 'true')) {
    throw new Error('Google account email is not verified.');
  }
  return claims;
}

export async function registerOrLoginWithGoogle(payload: GoogleAuthPayload): Promise<AuthResult> {
  if (!payload.credential) return { valid: false, error: 'A Google ID token credential is required.' };

  let claims: GoogleIdTokenClaims;
  try {
    claims = await verifyGoogleIdToken(payload.credential);
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }

  const existing = await findByEmail(claims.email);
  if (existing) {
    if (claims.picture && !existing.avatarUrl) {
      await getDb()
        .update(schema.usersTable)
        .set({ avatarUrl: claims.picture, updatedAt: new Date() })
        .where(eq(schema.usersTable.id, existing.id));
    }
    return { valid: true, user: toPublicUser({ ...existing, avatarUrl: existing.avatarUrl || claims.picture || null }) };
  }

  if (payload.primaryPan?.trim() && !isValidPan(payload.primaryPan)) {
    return { valid: false, error: 'Invalid PAN format. PAN must be 10 characters (e.g. ABCDE1234F).' };
  }

  const category = payload.investorCategory || 'Retail';
  // Google accounts get an unusable random password; they sign in only through Google.
  const { hash, salt } = hashPassword(`google:${claims.sub}:${crypto.randomUUID()}`);
  const [row] = await getDb()
    .insert(schema.usersTable)
    .values({
      id: `usr_g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: claims.name || claims.email.split('@')[0],
      email: claims.email.toLowerCase(),
      passwordHash: hash,
      salt,
      role: roleFor(category),
      investorCategory: category,
      primaryPan: payload.primaryPan?.trim() ? payload.primaryPan.trim().toUpperCase() : null,
      avatarUrl: claims.picture || null,
    })
    .returning();
  return { valid: true, user: toPublicUser(row) };
}
