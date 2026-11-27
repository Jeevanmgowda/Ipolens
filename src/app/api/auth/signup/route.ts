import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAndRegisterUser } from '@/services/authStore';
import { createSession, attachSessionCookie } from '@/lib/security/session';
import { sanitizeString } from '@/lib/security/sanitize';
import { handleRouteError, jsonError } from '@/lib/http';

const Body = z.object({
  name: z.string().trim().max(128),
  email: z.string().trim().max(256),
  password: z.string().max(256),
  investorCategory: z.enum(['Retail', 'sNII', 'bNII', 'Institutional']).default('Retail'),
  primaryPan: z.string().trim().max(10).optional(),
  termsAccepted: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const raw = Body.parse(await request.json());
    const body = { ...raw, name: sanitizeString(raw.name), primaryPan: raw.primaryPan?.toUpperCase() || undefined };
    const result = await validateAndRegisterUser(body);
    if (!result.valid || !result.user) return jsonError(400, result.error || 'Registration failed');

    const { token, expiresAt } = await createSession(result.user.id, true);
    return attachSessionCookie(
      NextResponse.json({ success: true, user: result.user, message: 'Account created successfully' }),
      token,
      expiresAt
    );
  } catch (err) {
    return handleRouteError(err, 'auth/signup');
  }
}
