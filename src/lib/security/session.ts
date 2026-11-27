import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { eq, and, gt } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { findUserById } from '@/services/authStore';
import { User } from '@/types/auth';

/**
 * Session security: cryptographically random tokens persisted in `user_sessions`,
 * presented via HttpOnly cookie or Bearer header.
 */

const SESSION_DURATION_STANDARD_MS = 24 * 60 * 60 * 1000; // 1 day
const SESSION_DURATION_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createSession(
  userId: string,
  rememberMe: boolean = true
): Promise<{ token: string; expiresAt: Date }> {
  const token = `sess_${crypto.randomBytes(32).toString('hex')}`;
  const expiresAt = new Date(Date.now() + (rememberMe ? SESSION_DURATION_REMEMBER_MS : SESSION_DURATION_STANDARD_MS));
  await getDb().insert(schema.sessionsTable).values({ id: token, userId, expiresAt, createdAt: new Date() });
  return { token, expiresAt };
}

export async function validateSession(token: string): Promise<string | null> {
  if (!token) return null;
  const rows = await getDb()
    .select({ userId: schema.sessionsTable.userId })
    .from(schema.sessionsTable)
    .where(and(eq(schema.sessionsTable.id, token), gt(schema.sessionsTable.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.userId ?? null;
}

export async function destroySession(token: string): Promise<boolean> {
  await getDb().delete(schema.sessionsTable).where(eq(schema.sessionsTable.id, token));
  return true;
}

export function extractTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)(?:ipolens_session|ipolens_token)=([^;]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);

  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return null;
}

/** Resolves the signed-in user, or null. Never falls back to a shared/demo identity. */
export async function getAuthenticatedUser(request: Request): Promise<User | null> {
  const token = extractTokenFromRequest(request);
  if (!token) return null;
  const userId = await validateSession(token);
  if (!userId) return null;
  return findUserById(userId);
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Sign in required.');
    this.name = 'UnauthorizedError';
  }
}

/** Throws UnauthorizedError when the request has no valid session. Pair with `handleRouteError`. */
export async function requireUser(request: Request): Promise<User> {
  const user = await getAuthenticatedUser(request);
  if (!user) throw new UnauthorizedError();
  return user;
}

export function unauthorized() {
  return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
}

/** Sets the session cookie on an auth response. */
export function attachSessionCookie(response: NextResponse, token: string, expiresAt: Date): NextResponse {
  response.cookies.set('ipolens_session', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
  });
  return response;
}
