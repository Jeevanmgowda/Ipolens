import { NextResponse } from 'next/server';

/**
 * Enterprise CORS (Cross-Origin Resource Sharing) Configuration
 * Restricts cross-origin requests strictly to authorized client domains.
 */

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.CLIENT_URL,
].filter(Boolean) as string[];

/**
 * Host the request was addressed to (first x-forwarded-host entry when behind a
 * reverse proxy / load balancer, otherwise the Host header).
 */
export function getRequestHost(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-host');
  const host = (forwarded ? forwarded.split(',')[0] : request.headers.get('host')) || '';
  return host.trim().toLowerCase() || null;
}

/**
 * Validates if the given origin is authorized to interact with the backend API.
 * Allowed: no Origin (non-browser / same-origin GET), the configured CLIENT_URL
 * and localhost defaults, *.ipolens.in, and same-origin requests — the page's
 * Origin host equals the host the request was sent to. Browsers set Origin
 * themselves, so a third-party page cannot pass the same-origin check.
 */
export function isAllowedOrigin(origin: string | null, requestHost?: string | null): boolean {
  if (!origin) return true; // Same-origin or non-browser server request
  if (DEFAULT_ALLOWED_ORIGINS.some((allowed) => allowed === origin) || origin.endsWith('.ipolens.in')) {
    return true;
  }
  if (!requestHost) return false;
  try {
    return new URL(origin).host.toLowerCase() === requestHost.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Applies strict CORS headers to an outgoing NextResponse.
 */
export function setCorsHeaders(
  response: NextResponse,
  origin: string | null,
  requestHost?: string | null
): NextResponse {
  if (origin && isAllowedOrigin(origin, requestHost)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, X-CSRF-Token'
    );
    response.headers.set('Access-Control-Max-Age', '86400');
  }
  return response;
}

/**
 * Returns a 204 No Content preflight response for OPTIONS requests.
 */
export function handleCorsPreflight(origin: string | null, requestHost?: string | null): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  return setCorsHeaders(response, origin, requestHost);
}
