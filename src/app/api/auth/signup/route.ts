import { NextResponse } from 'next/server';
import { validateAndRegisterUser } from '@/services/authStore';
import { createSession } from '@/lib/security/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = validateAndRegisterUser(body);

    if (!result.valid || !result.user) {
      return NextResponse.json(
        { success: false, error: result.error || 'Registration failed' },
        { status: 400 }
      );
    }

    const { token, expiresAt } = await createSession(result.user.id, true);

    const response = NextResponse.json({
      success: true,
      user: result.user,
      token,
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

    response.cookies.set('ipolens_token', `jwt_session_${result.user.id}`, {
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
