import { NextResponse } from 'next/server';
import { registerOrLoginWithGoogle } from '@/services/authStore';
import { createSession } from '@/lib/security/session';
import { verifyGoogleIdToken } from '@/lib/security/googleIdToken';
import { GOOGLE_NONCE_COOKIE, readCookie } from '@/lib/security/googleNonce';
import { GoogleAuthPayload } from '@/types/auth';

export const dynamic = 'force-dynamic';

/**
 * Identity fields (email, name, avatar, Google ID) are taken ONLY from a
 * server-verified Google ID token. The client may supply profile preferences
 * (investor category, primary PAN) but never its own identity.
 *
 * The credential-less demo account picker is allowed only outside production.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<GoogleAuthPayload>;
    const preferences = {
      investorCategory: body.investorCategory,
      primaryPan: body.primaryPan,
    };

    let payload: GoogleAuthPayload;

    if (body.credential) {
      let claims;
      try {
        // The token must carry the one-time nonce issued to this browser (replay protection).
        claims = await verifyGoogleIdToken(body.credential, {
          expectedNonce: readCookie(request, GOOGLE_NONCE_COOKIE) || '',
        });
      } catch (err) {
        console.warn('[Auth] Google ID token rejected:', err instanceof Error ? err.message : err);
        return NextResponse.json(
          { success: false, error: 'Google sign-in could not be verified. Please try again.' },
          { status: 401 }
        );
      }
      payload = {
        email: claims.email,
        name: claims.name || claims.email.split('@')[0],
        avatarUrl: claims.picture,
        googleId: claims.sub,
        ...preferences,
      };
    } else if (process.env.NODE_ENV !== 'production') {
      // Local development fallback (demo account picker without a real Google client ID).
      payload = {
        email: body.email || '',
        name: body.name || '',
        avatarUrl: body.avatarUrl,
        ...preferences,
      };
    } else {
      return NextResponse.json(
        { success: false, error: 'A Google ID token credential is required.' },
        { status: 401 }
      );
    }

    const result = registerOrLoginWithGoogle(payload);

    if (!result.valid || !result.user) {
      return NextResponse.json(
        { success: false, error: result.error || 'Google authentication failed' },
        { status: 400 }
      );
    }

    const { token, expiresAt } = await createSession(result.user.id, false); // 1-day default; 30 days only via sign-in "remember me" (audit L4)
    const maxAgeSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    const response = NextResponse.json({
      success: true,
      user: result.user,
      message: 'Signed in with Google successfully',
    });

    response.cookies.set('ipolens_session', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: maxAgeSeconds,
    });

    // One-time use: clear the sign-in nonce.
    response.cookies.set(GOOGLE_NONCE_COOKIE, '', { path: '/api/auth/google', maxAge: 0 });

    return response;
  } catch (err) {
    console.error('[Auth] Google sign-in error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
