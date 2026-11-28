import { getRedisClient } from '@/lib/redis';

/**
 * Enterprise Sliding Window Rate Limiter
 * Protects auth, financial mutation, and scraper endpoints from brute-force, DDoS, and abuse.
 */

interface RateLimitRecord {
  timestamps: number[];
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export type RateLimitTier = 'auth' | 'mutating' | 'api' | 'scraper' | 'login' | 'ai' | 'assets';

const TIER_CONFIG: Record<RateLimitTier, { limit: number; windowMs: number }> = {
  auth: { limit: 10, windowMs: 60 * 1000 }, // 10 requests per minute
  mutating: { limit: 30, windowMs: 60 * 1000 }, // 30 requests per minute
  scraper: { limit: 5, windowMs: 60 * 1000 }, // 5 sync triggers per minute
  api: { limit: 120, windowMs: 60 * 1000 }, // 120 requests per minute
  assets: { limit: 600, windowMs: 60 * 1000 }, // logo images: one per IPO card, cached by the browser
  ai: { limit: 30, windowMs: 60 * 60 * 1000 }, // 30 paid-AI calls per user per hour (keyed by user, not IP)
  login: { limit: 10, windowMs: 15 * 60 * 1000 }, // 10 sign-in attempts per account per 15 min (keyed by email hash, not IP)
};

// In-memory sliding window cache: key -> record
const memoryStore = new Map<string, RateLimitRecord>();

// Periodic garbage collection to prevent memory leaks (runs every 5 minutes)
let lastCleanup = Date.now();
function runGarbageCollection() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60 * 1000) return;
  lastCleanup = now;

  for (const [key, record] of memoryStore.entries()) {
    // Keep only timestamps from within the last 10 minutes
    const valid = record.timestamps.filter((ts) => now - ts < 10 * 60 * 1000);
    if (valid.length === 0) {
      memoryStore.delete(key);
    } else {
      record.timestamps = valid;
    }
  }
}

/**
 * Client IP for rate limiting (docs/security/AUDIT_2026-11-27.md, H7).
 *
 * X-Forwarded-For is client-controlled except for the entries appended by our own
 * reverse proxies. With TRUSTED_PROXY_HOPS = N (default 1: one proxy such as Vercel,
 * nginx or Cloudflare in front of the app), the client is the N-th entry from the
 * right; anything further left was supplied by the client and is ignored.
 * Production must run behind a proxy that appends the real client address.
 */
export function getClientIp(request: Request): string {
  const hopsRaw = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '1', 10);
  const hops = Number.isFinite(hopsRaw) && hopsRaw >= 1 ? Math.min(hopsRaw, 10) : 1;

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const chain = forwardedFor
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);
    if (chain.length > 0) {
      return chain[Math.max(0, chain.length - hops)].slice(0, 64);
    }
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp && realIp.trim()) return realIp.trim().slice(0, 64);

  return 'unknown';
}

/**
 * Checks rate limit for a client IP and tier.
 */
export function checkRateLimit(ip: string, tier: RateLimitTier = 'api'): RateLimitResult {
  runGarbageCollection();

  const now = Date.now();
  const { limit, windowMs } = TIER_CONFIG[tier] || TIER_CONFIG.api;
  const key = `${tier}:${ip}`;

  const record = memoryStore.get(key) || { timestamps: [] };
  // Remove timestamps outside current sliding window
  const activeWindowStart = now - windowMs;
  const validTimestamps = record.timestamps.filter((ts) => ts > activeWindowStart);

  if (validTimestamps.length >= limit) {
    const oldest = validTimestamps[0];
    const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetSeconds,
    };
  }

  validTimestamps.push(now);
  memoryStore.set(key, { timestamps: validTimestamps });

  const remaining = Math.max(0, limit - validTimestamps.length);
  const resetSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  return {
    allowed: true,
    limit,
    remaining,
    resetSeconds,
  };
}

/**
 * Applies rate limiting headers to a response.
 */
export function applyRateLimitHeaders(
  headers: Headers,
  result: RateLimitResult
): void {
  headers.set('X-RateLimit-Limit', String(result.limit));
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(result.resetSeconds));

  if (!result.allowed) {
    headers.set('Retry-After', String(result.resetSeconds));
  }
}

/**
 * Rate limit shared across instances via Redis when REDIS_URL / UPSTASH_REDIS_URL
 * is configured and connected (fixed window per tier). Falls back to the
 * in-memory sliding window above when Redis is absent, connecting or failing.
 */
export async function checkRateLimitDistributed(key: string, tier: RateLimitTier = 'api'): Promise<RateLimitResult> {
  const client = getRedisClient();
  if (!client || typeof client.multi !== 'function') {
    return checkRateLimit(key, tier);
  }
  if (client.status !== 'ready') {
    // lazyConnect client: start connecting, use the local limiter meanwhile.
    if (client.status === 'wait') client.connect().catch(() => {});
    return checkRateLimit(key, tier);
  }

  const { limit, windowMs } = TIER_CONFIG[tier] || TIER_CONFIG.api;
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const redisKey = `ratelimit:${tier}:${key}:${windowStart}`;

  try {
    const results = await client.multi().incr(redisKey).pexpire(redisKey, windowMs).exec();
    const count = Number(results?.[0]?.[1]);
    if (!Number.isFinite(count)) return checkRateLimit(key, tier);

    const resetSeconds = Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));
    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetSeconds,
    };
  } catch {
    return checkRateLimit(key, tier);
  }
}
