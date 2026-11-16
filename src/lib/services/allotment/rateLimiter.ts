/**
 * In-memory sliding-window rate limiter for allotment inquiries.
 * Protects registrar gateways and the IPOLENS backend from automated query abuse.
 */
interface RateLimitRecord {
  timestamps: number[];
}

class AllotmentRateLimiter {
  private records: Map<string, RateLimitRecord> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(windowMs: number = 60000, maxRequests: number = 15) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Periodic cleanup of stale client IPs every 5 minutes
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Check if a client IP is allowed to perform an allotment inquiry
   */
  public check(clientIp: string): { allowed: boolean; remaining: number; resetMs: number } {
    const ip = clientIp || 'unknown-client';
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let record = this.records.get(ip);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(ip, record);
    }

    // Filter out timestamps outside the sliding window
    record.timestamps = record.timestamps.filter((t) => t > windowStart);

    if (record.timestamps.length >= this.maxRequests) {
      const oldest = record.timestamps[0];
      const resetMs = Math.max(0, oldest + this.windowMs - now);
      return {
        allowed: false,
        remaining: 0,
        resetMs,
      };
    }

    // Record this inquiry
    record.timestamps.push(now);
    return {
      allowed: true,
      remaining: this.maxRequests - record.timestamps.length,
      resetMs: this.windowMs,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    for (const [ip, record] of this.records.entries()) {
      record.timestamps = record.timestamps.filter((t) => t > windowStart);
      if (record.timestamps.length === 0) {
        this.records.delete(ip);
      }
    }
  }
}

export const allotmentRateLimiter = new AllotmentRateLimiter(60000, 15);

