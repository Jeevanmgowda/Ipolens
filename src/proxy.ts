import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getClientIp, checkRateLimitDistributed, applyRateLimitHeaders, RateLimitTier } from '@/lib/security/rateLimiter';
import { checkBodySize } from '@/lib/security/bodyLimits';
import { buildPageCsp, generateNonce } from '@/lib/security/csp';
import { isAllowedOrigin, setCorsHeaders, handleCorsPreflight, getRequestHost } from '@/lib/security/cors';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');
  const requestHost = getRequestHost(request);
  const clientIp = getClientIp(request);

  // 1. CORS Preflight Handling for API
  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    return handleCorsPreflight(origin, requestHost);
  }

  // 2. Untrusted Cross-Origin Request Protection
  if (origin && pathname.startsWith('/api/') && !isAllowedOrigin(origin, requestHost)) {
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
      origin,
      requestHost
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
      return setCorsHeaders(resp, origin, requestHost);
    }
  }

  // 4. Admin paths: cheap pre-filter only (no session cookie -> sign in). This is NOT
  //    authorization: every admin page/route must call requireAdmin() from
  //    src/lib/security/adminGuard.ts, which validates the session and role (audit L3).
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin/')) {
    const sessionToken = request.cookies.get('ipolens_session')?.value;

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

  // 5. /api/scraper/sync enforces admin role or CRON_SECRET itself (constant-time check).

  // 6. Pages: per-request nonce-based CSP (audit M3). Next.js reads the nonce from the
  //    request's CSP header and applies it to its own scripts during rendering.
  if (!pathname.startsWith('/api/')) {
    const csp = buildPageCsp(generateNonce(), process.env.NODE_ENV === 'development');
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('Content-Security-Policy', csp);
    const pageResponse = NextResponse.next({ request: { headers: requestHeaders } });
    pageResponse.headers.set('Content-Security-Policy', csp);
    return pageResponse;
  }

  // 7. API: proceed and attach CORS headers (the API CSP comes from next.config.ts)
  const response = NextResponse.next();
  return setCorsHeaders(response, origin, requestHost);
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
