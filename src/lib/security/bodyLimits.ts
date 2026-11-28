/**
 * Per-route request body limits for /api (docs/security/AUDIT_2026-11-27.md, M6).
 * Enforced in src/proxy.ts before the body is read, using Content-Length.
 */

const KB = 1024;
const MB = 1024 * KB;

export const DEFAULT_API_BODY_LIMIT = 64 * KB;

/** Longest matching prefix wins. */
const ROUTE_BODY_LIMITS: Array<[prefix: string, bytes: number]> = [
  ['/api/analysis', 27 * MB], // DRHP PDF uploads up to 25 MB (multipart overhead included)
  ['/api/market/drhp-rag', 3 * MB], // pasted DRHP text (≈2M characters)
  ['/api/portfolio/upload', 2 * MB], // broker CSV text
  ['/api/allotment/scan', 256 * KB], // pasted registrar slip text
];

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function bodyLimitFor(pathname: string): number {
  let best: [string, number] | null = null;
  for (const entry of ROUTE_BODY_LIMITS) {
    if (pathname === entry[0] || pathname.startsWith(`${entry[0]}/`)) {
      if (!best || entry[0].length > best[0].length) best = entry;
    }
  }
  return best ? best[1] : DEFAULT_API_BODY_LIMIT;
}

/**
 * Returns an error status and message when the request body is too large or its
 * size is undeclared, otherwise null.
 */
export function checkBodySize(
  pathname: string,
  method: string,
  headers: Headers
): { status: 411 | 413; error: string } | null {
  if (!pathname.startsWith('/api/') || !BODY_METHODS.has(method)) return null;

  const contentLength = headers.get('content-length');
  const transferEncoding = headers.get('transfer-encoding');
  if (contentLength === null) {
    // Browsers always send Content-Length for fetch bodies; refuse unbounded chunked uploads.
    return transferEncoding ? { status: 411, error: 'Content-Length is required for request bodies.' } : null;
  }

  const size = Number(contentLength);
  if (!Number.isFinite(size) || size < 0) {
    return { status: 411, error: 'Invalid Content-Length header.' };
  }
  const limit = bodyLimitFor(pathname);
  if (size > limit) {
    return { status: 413, error: `Request body too large (limit ${Math.round(limit / KB)} KB).` };
  }
  return null;
}
