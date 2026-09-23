import { NextResponse } from 'next/server';
import { registerOrLoginWithGoogle } from '@/services/authStore';

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

    const response = NextResponse.json({
      success: true,
      user: result.user,
      token: `jwt_session_${result.user.id}_${Date.now()}`,
      message: 'Signed in with Google successfully',
    });

    response.cookies.set('ipolens_token', `jwt_session_${result.user.id}`, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
