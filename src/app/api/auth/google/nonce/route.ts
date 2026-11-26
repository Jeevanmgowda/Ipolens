import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { GOOGLE_NONCE_COOKIE } from '@/lib/security/googleNonce';

export const dynamic = 'force-dynamic';

/**
 * Issues a one-time nonce for Google Identity Services. The browser passes it to
 * google.accounts.id.initialize; Google embeds it in the ID token; /api/auth/google
 * accepts the token only if the nonce matches this HttpOnly cookie
 * (docs/security/BASELINE_AUDIT.md, L4: a captured ID token cannot be replayed).
 */
export async function GET() {
  const nonce = crypto.randomBytes(24).toString('base64url');
  const response = NextResponse.json({ success: true, nonce });
  response.cookies.set(GOOGLE_NONCE_COOKIE, nonce, {
    path: '/api/auth/google',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
