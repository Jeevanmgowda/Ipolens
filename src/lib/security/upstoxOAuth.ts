/** HttpOnly cookie that carries the OAuth `state` between /api/auth/upstox and its callback (CSRF protection). */
export const UPSTOX_STATE_COOKIE = 'upstox_oauth_state';
export const UPSTOX_STATE_MAX_AGE_SECONDS = 10 * 60;
