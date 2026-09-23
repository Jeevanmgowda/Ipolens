import { NextResponse } from 'next/server';
import { validateSignInCredentials } from '@/services/authStore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = validateSignInCredentials(body);

    if (!result.valid || !result.user) {
      return NextResponse.json(
        { success: false, error: result.error || 'Authentication failed' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: result.user,
      token: `jwt_session_${result.user.id}_${Date.now()}`,
      message: 'Signed in successfully',
    });

    // Set HTTP-only cookie for session simulation
    response.cookies.set('ipolens_token', `jwt_session_${result.user.id}`, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: body.rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24, // 30 days or 1 day
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
