import crypto from 'crypto';
import { db, isDatabaseActive, reportDatabaseFailure, schema } from '@/db';
import { eq, and, gt } from 'drizzle-orm';
import { registeredUsersStore, toPublicUser } from '@/services/authStore';
import { User } from '@/types/auth';

/**
 * Enterprise Session & Route Security Service
 * Issues cryptographically random session tokens stored in DB / memory,
 * validated from the HttpOnly `ipolens_session` cookie only (audit M9: no Bearer
 * sessions and no token in response bodies, so scripts can never hold one).
 */

export interface ActiveSession {
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  /** When this cache entry was last confirmed against the database. */
  checkedAt?: number;
}

/** In database mode, cached sessions are re-checked this often, so a sign-out on
 *  another instance takes effect within a minute (audit L4). */
const SESSION_RECHECK_MS = 60 * 1000;

// In-memory sessions store fallback
const inMemorySessions = new Map<string, ActiveSession>();

const SESSION_DURATION_STANDARD_MS = 24 * 60 * 60 * 1000; // 1 day
const SESSION_DURATION_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Create a new user session
 */
export async function createSession(
  userId: string,
  rememberMe: boolean = false
): Promise<{ token: string; expiresAt: Date }> {
  const token = `sess_${crypto.randomBytes(32).toString('hex')}`;
  const duration = rememberMe ? SESSION_DURATION_REMEMBER_MS : SESSION_DURATION_STANDARD_MS;
  const expiresAt = new Date(Date.now() + duration);
  const createdAt = new Date();

  // Save to PostgreSQL if configured
  if (isDatabaseActive() && db) {
    try {
      await db.insert(schema.sessionsTable).values({
        id: token,
        userId,
        expiresAt,
        createdAt,
      });
    } catch (err) {
      reportDatabaseFailure('saving session to DB', err);
    }
  }

  // Always keep in-memory cache synchronized
  inMemorySessions.set(token, {
    token,
    userId,
    expiresAt,
    createdAt,
    checkedAt: Date.now(),
  });

  return { token, expiresAt };
}

/**
 * Validate a session token and return the associated userId
 */
export async function validateSession(token: string): Promise<string | null> {
  if (!token) return null;

  // Check in-memory cache first
  const cached = inMemorySessions.get(token);
  if (cached) {
    if (cached.expiresAt.getTime() <= Date.now()) {
      inMemorySessions.delete(token);
      return null;
    }
    const fresh = !cached.checkedAt || Date.now() - cached.checkedAt < SESSION_RECHECK_MS;
    if (fresh || !isDatabaseActive() || !db) {
      return cached.userId;
    }
  }

  // Check database if configured
  if (isDatabaseActive() && db) {
    try {
      const rows = await db
        .select()
        .from(schema.sessionsTable)
        .where(
          and(
            eq(schema.sessionsTable.id, token),
            gt(schema.sessionsTable.expiresAt, new Date())
          )
        )
        .limit(1);

      if (rows.length > 0) {
        const row = rows[0];
        // Cache in memory
        inMemorySessions.set(token, {
          token: row.id,
          userId: row.userId,
          expiresAt: row.expiresAt,
          createdAt: row.createdAt,
          checkedAt: Date.now(),
        });
        return row.userId;
      }
      // Revoked or expired in the database (e.g. signed out on another instance).
      inMemorySessions.delete(token);
      return null;
    } catch (err) {
      reportDatabaseFailure('querying session from DB', err);
    }
  }

  return null;
}

/**
 * Invalidate / destroy a session
 */
export async function destroySession(token: string): Promise<boolean> {
  inMemorySessions.delete(token);

  if (isDatabaseActive() && db) {
    try {
      await db.delete(schema.sessionsTable).where(eq(schema.sessionsTable.id, token));
      return true;
    } catch (err) {
      reportDatabaseFailure('deleting session from DB', err);
    }
  }
  return true;
}

/**
 * Extract the session token from the HttpOnly session cookie.
 */
export function extractTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)ipolens_session=([^;]+)/);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Standard 401 response for routes that require a signed-in user.
 */
export function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ success: false, error: 'Authentication required. Please sign in.' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Resolves the authenticated user from the incoming request.
 * Returns null when no valid session is present. Routes holding per-user data
 * must reject null with unauthorizedResponse() rather than use a shared bucket.
 */
export async function getAuthenticatedUser(request: Request): Promise<User | null> {
  const token = extractTokenFromRequest(request);
  if (!token) return null;

  const userId = await validateSession(token);
  if (!userId) return null;

  // Find user in registeredUsersStore or DB
  const user = registeredUsersStore.find((u) => u.id === userId);
  if (user) {
    return toPublicUser(user);
  }

  if (isDatabaseActive() && db) {
    try {
      const rows = await db
        .select()
        .from(schema.usersTable)
        .where(eq(schema.usersTable.id, userId))
        .limit(1);

      if (rows.length > 0) {
        const r = rows[0];
        return toPublicUser({
          id: r.id,
          name: r.name,
          email: r.email,
          role: r.role as any,
          investorCategory: r.investorCategory as any,
          primaryPan: r.primaryPan || undefined,
          avatarUrl: r.avatarUrl || undefined,
          createdAt: r.createdAt.toISOString(),
        });
      }
    } catch (err) {
      reportDatabaseFailure('querying user profile from DB', err);
    }
  }

  return null;
}
