import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/security/session';
import type { User } from '@/types/auth';

/**
 * Route guards. Use at the top of a handler:
 *   const auth = await requireUserOr401(request);
 *   if (!auth.user) return auth.response;
 */
export async function requireUserOr401(
  request: Request
): Promise<{ user: User; response: null } | { user: null; response: NextResponse }> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return { user: null, response: NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 }) };
  }
  return { user, response: null };
}

export function isAdmin(user: User | null | undefined): boolean {
  return Boolean(user && user.role === 'admin');
}

/** Escapes text for safe interpolation into HTML (element content and quoted attributes). */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Demo accounts with published passwords are never allowed outside local development. */
export function demoAccountsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== 'production' && env.ALLOW_DEMO_ACCOUNTS !== 'false';
}
