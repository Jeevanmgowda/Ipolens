import { NextResponse } from 'next/server';
import { loadUserFromDatabase, persistUser, validateAndRegisterUser } from '@/lib/services/authStore';
import { createSession } from '@/lib/security/session';
import { sanitizeString } from '@/lib/security/sanitize';
import { publicErrorMessage } from '@/lib/security/apiError';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const body = {
      ...rawBody,
      name: rawBody.name ? sanitizeString(rawBody.name) : '',
      email: rawBody.email ? sanitizeString(rawBody.email) : '',
      primaryPan: rawBody.primaryPan ? sanitizeString(rawBody.primaryPan).toUpperCase() : undefined,
    };
    await loadUserFromDatabase(body.email);
    const result = validateAndRegisterUser(body);

    if (!result.valid || !result.user) {
      return NextResponse.json(
        { success: false, error: result.error || 'Registration failed' },
        { status: 400 }
      );
    }
    await persistUser(result.user.id);

    const { token, expiresAt } = await createSession(result.user.id, true);

    const response = NextResponse.json({
      success: true,
      user: result.user,
      message: 'Account created successfully',
    });

    const maxAgeSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    response.cookies.set('ipolens_session', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: maxAgeSeconds,
    });

    return response;
  } catch (err: any) {
    console.error('[API] /api/auth/signup:', err);
    return NextResponse.json(
      { success: false, error: publicErrorMessage(err, 'Internal server error') },
      { status: 500 }
    );
  }
}
