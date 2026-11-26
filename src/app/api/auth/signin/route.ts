import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { INVALID_CREDENTIALS_MESSAGE, loadUserFromDatabase, validateSignInCredentials } from '@/lib/services/authStore';
import { applyRateLimitHeaders, checkRateLimitDistributed } from '@/lib/security/rateLimiter';
import { createSession } from '@/lib/security/session';
import { sanitizeString } from '@/lib/security/sanitize';
import { publicErrorMessage } from '@/lib/security/apiError';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const body = {
      ...rawBody,
      email: rawBody.email ? sanitizeString(rawBody.email) : '',
    };
    if (typeof body.email !== 'string' || body.email.length > 254 || typeof body.password !== 'string' || body.password.length > 128) {
      return NextResponse.json({ success: false, error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
    }

    // Per-account throttle, independent of IP, so rotating IPs cannot brute-force one account (H5).
    const accountKey = `login:${crypto.createHash('sha256').update(body.email.trim().toLowerCase()).digest('hex')}`;
    const throttle = await checkRateLimitDistributed(accountKey, 'login');
    if (!throttle.allowed) {
      const limited = NextResponse.json(
        { success: false, error: `Too many sign-in attempts for this account. Try again in ${Math.ceil(throttle.resetSeconds / 60)} minutes.` },
        { status: 429 }
      );
      applyRateLimitHeaders(limited.headers, throttle);
      return limited;
    }

    await loadUserFromDatabase(body.email);
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

    return response;
  } catch (err: any) {
    console.error('[API] /api/auth/signin:', err);
    return NextResponse.json(
      { success: false, error: publicErrorMessage(err, 'Internal server error') },
      { status: 500 }
    );
  }
}
