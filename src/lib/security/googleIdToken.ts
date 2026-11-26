import crypto from 'crypto';

/**
 * Server-side verification of Google Identity Services ID tokens (RS256 JWTs).
 * Uses Google's published JWKS and Node's built-in crypto — no extra dependency.
 * https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
 */

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const VALID_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const CLOCK_SKEW_SECONDS = 60;
const DEFAULT_JWKS_TTL_MS = 60 * 60 * 1000;

export interface GoogleIdTokenClaims {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  aud: string;
  iss: string;
  exp: number;
  iat?: number;
  nonce?: string;
}

type Jwk = crypto.JsonWebKey & { kid?: string };

let jwksCache: { keys: Jwk[]; expiresAt: number } | null = null;

export function getGoogleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
}

async function fetchGoogleJwks(forceRefresh = false): Promise<Jwk[]> {
  if (!forceRefresh && jwksCache && jwksCache.expiresAt > Date.now()) {
    return jwksCache.keys;
  }
  const res = await fetch(GOOGLE_JWKS_URL);
  if (!res.ok) {
    throw new Error(`Unable to fetch Google signing keys (HTTP ${res.status})`);
  }
  const body = (await res.json()) as { keys?: Jwk[] };
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1]);
  jwksCache = {
    keys: body.keys || [],
    expiresAt: Date.now() + (Number.isFinite(maxAge) && maxAge > 0 ? maxAge * 1000 : DEFAULT_JWKS_TTL_MS),
  };
  return jwksCache.keys;
}

function decodeSegment<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T;
}

/**
 * Verifies a Google ID token and returns its claims.
 * Throws if the signature, audience, issuer, expiry or email verification is invalid.
 * `getKeys` is injectable for tests.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  options: {
    clientId?: string;
    getKeys?: (forceRefresh: boolean) => Promise<Jwk[]>;
    nowSeconds?: number;
    /** When set, the token's nonce claim must match (replay protection, BASELINE_AUDIT L4). */
    expectedNonce?: string;
  } = {}
): Promise<GoogleIdTokenClaims> {
  const clientId = options.clientId ?? getGoogleClientId();
  if (!clientId) {
    throw new Error('Google sign-in is not configured on the server (GOOGLE_CLIENT_ID missing).');
  }

  const parts = typeof idToken === 'string' ? idToken.split('.') : [];
  if (parts.length !== 3) {
    throw new Error('Malformed Google ID token.');
  }
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; kid?: string };
  let claims: GoogleIdTokenClaims;
  try {
    header = decodeSegment(headerB64);
    claims = decodeSegment(payloadB64);
  } catch {
    throw new Error('Malformed Google ID token.');
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unsupported Google ID token algorithm.');
  }

  const getKeys = options.getKeys ?? fetchGoogleJwks;
  let jwk = (await getKeys(false)).find((k) => k.kid === header.kid);
  if (!jwk) {
    // Google rotates keys; refresh once before rejecting.
    jwk = (await getKeys(true)).find((k) => k.kid === header.kid);
  }
  if (!jwk) {
    throw new Error('Google ID token signed with an unknown key.');
  }

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const signatureValid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${headerB64}.${payloadB64}`),
    publicKey,
    Buffer.from(signatureB64, 'base64url')
  );
  if (!signatureValid) {
    throw new Error('Invalid Google ID token signature.');
  }

  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!VALID_ISSUERS.has(claims.iss)) {
    throw new Error('Google ID token has an invalid issuer.');
  }
  if (claims.aud !== clientId) {
    throw new Error('Google ID token was issued for a different client.');
  }
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < now) {
    throw new Error('Google ID token has expired.');
  }
  if (!claims.email || claims.email_verified !== true) {
    throw new Error('Google account email is not verified.');
  }
  if (options.expectedNonce !== undefined) {
    const given = Buffer.from(String(claims.nonce || ''));
    const expected = Buffer.from(options.expectedNonce);
    if (!options.expectedNonce || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
      throw new Error('Google ID token nonce mismatch.');
    }
  }

  return claims;
}
