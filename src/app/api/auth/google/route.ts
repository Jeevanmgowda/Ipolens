import { NextResponse } from 'next/server';
import { registerOrLoginWithGoogle } from '@/services/authStore';
import { createSession } from '@/lib/security/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = registerOrLoginWithGoogle(body);

    if (!result.valid || !result.user) {
      return NextResponse.json(
        { success: false, error: result.error || 'Google authentication failed' },
        { status: 400 }
      );
    }

    const { token, expiresAt } = await createSession(result.user.id, true);
    const maxAgeSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    const response = NextResponse.json({
      success: true,
      user: result.user,
      token,
      message: 'Signed in with Google successfully',
    });

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
