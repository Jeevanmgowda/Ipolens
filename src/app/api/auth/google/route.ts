import { NextResponse } from 'next/server';
import { z } from 'zod';
import { registerOrLoginWithGoogle } from '@/services/authStore';
import { createSession, attachSessionCookie } from '@/lib/security/session';
import { handleRouteError, jsonError } from '@/lib/http';

export const dynamic = 'force-dynamic';

const Body = z.object({
  credential: z.string().min(20).max(4096),
  investorCategory: z.enum(['Retail', 'sNII', 'bNII', 'Institutional']).optional(),
  primaryPan: z.string().trim().max(10).optional(),
});

/** Google Identity Services sign-in. Identity comes only from the verified ID token. */
export async function POST(request: Request) {
  try {
    const body = Body.parse(await request.json());
    const result = await registerOrLoginWithGoogle({ email: '', name: '', ...body });
    if (!result.valid || !result.user) return jsonError(401, result.error || 'Google authentication failed');

    const { token, expiresAt } = await createSession(result.user.id, true);
    return attachSessionCookie(
      NextResponse.json({ success: true, user: result.user, message: 'Signed in with Google successfully' }),
      token,
      expiresAt
    );
  } catch (err) {
    return handleRouteError(err, 'auth/google');
  }
}
