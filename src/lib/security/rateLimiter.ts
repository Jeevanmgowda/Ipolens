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

export type RateLimitTier = 'auth' | 'mutating' | 'api' | 'scraper';

const TIER_CONFIG: Record<RateLimitTier, { limit: number; windowMs: number }> = {
  auth: { limit: 10, windowMs: 60 * 1000 }, // 10 requests per minute
  mutating: { limit: 30, windowMs: 60 * 1000 }, // 30 requests per minute
  scraper: { limit: 5, windowMs: 60 * 1000 }, // 5 sync triggers per minute
  api: { limit: 120, windowMs: 60 * 1000 }, // 120 requests per minute
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
 * Extracts client IP from incoming Next.js Request headers.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp && realIp.trim()) return realIp.trim();

  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp && cfIp.trim()) return cfIp.trim();

  return '127.0.0.1';
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
