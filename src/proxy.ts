import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getClientIp, checkRateLimitDistributed, applyRateLimitHeaders, RateLimitTier } from '@/lib/security/rateLimiter';
import { checkBodySize } from '@/lib/security/bodyLimits';
import { isAllowedOrigin, setCorsHeaders, handleCorsPreflight } from '@/lib/security/cors';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');
  const clientIp = getClientIp(request);

  // 1. CORS Preflight Handling for API
  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    return handleCorsPreflight(origin);
  }

  // 2. Untrusted Cross-Origin Request Protection
  if (origin && pathname.startsWith('/api/') && !isAllowedOrigin(origin)) {
    return new NextResponse(
      JSON.stringify({ success: false, error: 'Cross-origin request blocked by CORS policy' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // 2b. Request body size limits (before any handler reads the body)
  const bodyProblem = checkBodySize(pathname, request.method, request.headers);
  if (bodyProblem) {
    return setCorsHeaders(
      new NextResponse(JSON.stringify({ success: false, error: bodyProblem.error }), {
        status: bodyProblem.status,
        headers: { 'Content-Type': 'application/json' },
      }),
      origin
    );
  }

  // 3. Rate Limiting across API Endpoints
  if (pathname.startsWith('/api/')) {
    let tier: RateLimitTier = 'api';
    if (pathname.startsWith('/api/auth/')) {
      tier = 'auth';
    } else if (pathname.startsWith('/api/scraper/')) {
      tier = 'scraper';
    } else if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      tier = 'mutating';
    }

    const rateLimit = await checkRateLimitDistributed(clientIp, tier);
    if (!rateLimit.allowed) {
      const resp = new NextResponse(
        JSON.stringify({
          success: false,
          error: `Rate limit exceeded. Please retry in ${rateLimit.resetSeconds} seconds.`,
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      applyRateLimitHeaders(resp.headers, rateLimit);
      return setCorsHeaders(resp, origin);
    }
  }

  // 4. Admin UI and Admin API Route Protection (RBAC)
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin/')) {
    const sessionToken =
      request.cookies.get('ipolens_session')?.value ||
      request.cookies.get('ipolens_token')?.value ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!sessionToken) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(
          JSON.stringify({ success: false, error: 'Administrator authorization required' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const signInUrl = new URL('/signin', request.url);
      signInUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  // 5. Scraper Sync API Protection
  if (pathname === '/api/scraper/sync' && request.method === 'POST') {
    const authHeader = request.headers.get('authorization') || '';
    const cronSecret = process.env.CRON_SECRET;
    const sessionToken =
      request.cookies.get('ipolens_session')?.value ||
      request.cookies.get('ipolens_token')?.value;

    const hasValidBearer = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const hasSession = !!sessionToken;

    if (!hasValidBearer && !hasSession) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Unauthorized: Scraper synchronization requires administrative privileges or valid CRON_SECRET.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // 6. Proceed and attach CORS and Security Headers
  const response = NextResponse.next();
  return setCorsHeaders(response, origin);
}

export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (.svg, .png, .jpg)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
