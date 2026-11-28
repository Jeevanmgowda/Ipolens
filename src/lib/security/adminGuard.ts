import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/security/session';

/**
 * Server-wide integrations (e.g. connecting the app's Upstox market-data account)
 * are admin-only in production; local development stays open for setup
 * (docs/security/AUDIT_2026-11-27.md, M7). Returns a response to send, or null to proceed.
 */
export async function requireAdminInProduction(request: Request): Promise<NextResponse | null> {
  if (process.env.NODE_ENV !== 'production') return null;
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required. Please sign in.' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Administrator access required.' }, { status: 403 });
  }
  return null;
}
