/**
 * Content-Security-Policy builder (docs/security/AUDIT_2026-11-27.md, M3).
 *
 * Pages get a per-request nonce with 'strict-dynamic': only scripts carrying the
 * nonce (Next.js framework/page bundles) and scripts they load (Google sign-in,
 * TradingView widget) can run. 'unsafe-inline' is no longer allowed for scripts
 * in production. Styles keep 'unsafe-inline' because React style attributes need it.
 */
export function buildPageCsp(nonce: string, isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    // Host sources are ignored by browsers that support 'strict-dynamic'; they are
    // kept only as a fallback for older (CSP level 2) browsers.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://accounts.google.com/gsi/client https://s3.tradingview.com${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    isDev
      ? "connect-src 'self' http://localhost:* ws://localhost:* https://accounts.google.com/gsi/"
      : "connect-src 'self' https://accounts.google.com/gsi/",
    "frame-src https://accounts.google.com/gsi/ https://s.tradingview.com https://www.tradingview-widget.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  if (!isDev) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

/** API responses are JSON/SSE/HTML-callback pages: nothing should execute or embed. */
export const API_CSP = "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64');
}
