/** HttpOnly cookie holding the one-time Google sign-in nonce (see /api/auth/google/nonce). */
export const GOOGLE_NONCE_COOKIE = 'ipolens_g_nonce';

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}
