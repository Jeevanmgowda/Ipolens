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
 * Validates if the given origin is authorized to interact with the backend API.
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // Same-origin or non-browser server request
  // In development, any local port is fine (the dev server may not get port 3000).
  if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return DEFAULT_ALLOWED_ORIGINS.some((allowed) => allowed === origin || origin.endsWith('.ipolens.in'));
}

/**
 * Applies strict CORS headers to an outgoing NextResponse.
 */
export function setCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  if (origin && isAllowedOrigin(origin)) {
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
export function handleCorsPreflight(origin: string | null): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  return setCorsHeaders(response, origin);
}
