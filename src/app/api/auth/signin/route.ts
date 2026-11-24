import { NextResponse } from 'next/server';
import { validateSignInCredentials } from '@/services/authStore';
import { createSession } from '@/lib/security/session';
import { sanitizeString } from '@/lib/security/sanitize';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const body = {
      ...rawBody,
      email: rawBody.email ? sanitizeString(rawBody.email) : '',
    };
    const result = validateSignInCredentials(body);

    if (!result.valid || !result.user) {
      return NextResponse.json(
        { success: false, error: result.error || 'Authentication failed' },
        { status: 401 }
      );
    }

    const { token, expiresAt } = await createSession(result.user.id, !!body.rememberMe);

    const response = NextResponse.json({
      success: true,
      user: result.user,
      token,
      message: 'Signed in successfully',
    });

    const maxAgeSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    // Set secure HttpOnly cookies
    response.cookies.set('ipolens_session', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: maxAgeSeconds,
    });

    response.cookies.set('ipolens_token', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: maxAgeSeconds,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
