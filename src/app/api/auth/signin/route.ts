import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateSignInCredentials } from '@/services/authStore';
import { createSession, attachSessionCookie } from '@/lib/security/session';
import { handleRouteError, jsonError } from '@/lib/http';

const Body = z.object({
  email: z.string().trim().max(256),
  password: z.string().max(256),
  rememberMe: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = Body.parse(await request.json());
    const result = await validateSignInCredentials(body);
    if (!result.valid || !result.user) return jsonError(401, result.error || 'Authentication failed');

    const { token, expiresAt } = await createSession(result.user.id, !!body.rememberMe);
    return attachSessionCookie(
      NextResponse.json({ success: true, user: result.user, message: 'Signed in successfully' }),
      token,
      expiresAt
    );
  } catch (err) {
    return handleRouteError(err, 'auth/signin');
  }
}
