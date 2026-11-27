import Redis from 'ioredis';
import { EventEmitter } from 'events';

// In-memory fallback for environments without Redis configured or when Redis times out
class InMemoryRedisEmitter extends EventEmitter {
  private store = new Map<string, { value: string; expiry?: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiry && Date.now() > item.expiry) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  /** Supports SET key value [EX s | PX ms] [NX | XX] like ioredis. Returns null when NX/XX blocks the write. */
  async set(key: string, value: string, ...args: Array<string | number>): Promise<'OK' | null> {
    let expiry: number | undefined;
    let nx = false;
    let xx = false;
    for (let i = 0; i < args.length; i++) {
      const a = String(args[i]).toUpperCase();
      if (a === 'EX') expiry = Date.now() + Number(args[++i]) * 1000;
      else if (a === 'PX') expiry = Date.now() + Number(args[++i]);
      else if (a === 'NX') nx = true;
      else if (a === 'XX') xx = true;
    }
    const exists = (await this.get(key)) !== null;
    if ((nx && exists) || (xx && !exists)) return null;
    this.store.set(key, { value, expiry });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const k of keys) if (this.store.delete(k)) n++;
    return n;
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const next = (current ? Number(current) : 0) + 1;
    const prev = this.store.get(key);
    this.store.set(key, { value: String(next), expiry: prev?.expiry });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const item = this.store.get(key);
    if (!item) return 0;
    item.expiry = Date.now() + seconds * 1000;
    return 1;
  }

  async pttl(key: string): Promise<number> {
    const item = this.store.get(key);
    if (!item) return -2;
    if (!item.expiry) return -1;
    return Math.max(0, item.expiry - Date.now());
  }

  /** Test helper: wipe all keys. */
  flushall(): void {
    this.store.clear();
  }

  async publish(channel: string, message: string): Promise<number> {
    this.emit('message', channel, message);
    return 1;
  }

  async subscribe(channel: string, cb?: (err: Error | null, count?: number) => void): Promise<number> {
    if (cb) cb(null, 1);
    return 1;
  }

  async unsubscribe(): Promise<number> {
    return 1;
  }

  async quit(): Promise<'OK'> {
    this.removeAllListeners();
    return 'OK';
  }

  async disconnect(): Promise<void> {
    this.removeAllListeners();
  }
}

/** The subset of the Redis API the app uses; implemented by ioredis and the in-memory fallback. */
export interface RedisClientLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: Array<string | number>): Promise<'OK' | null>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string, cb?: (err: Error | null, count?: number) => void): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  removeListener(event: string, listener: (...args: unknown[]) => void): unknown;
}

// Global in-memory singleton fallback
export const globalMemoryFallback = new InMemoryRedisEmitter();

let singletonClient: RedisClientLike | null = null;
let isRedisCircuitOpen = false;
let redisCircuitCooldownUntil = 0;
let hasLoggedWarning = false;

function cleanRedisUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  let url = rawUrl.trim();
  if (url.startsWith('redis-cli')) {
    const match = url.match(/-u\s+([^\s]+)/);
    if (match) url = match[1];
  }
  if (url.startsWith('redis://') && url.includes('.upstash.io')) {
    url = url.replace('redis://', 'rediss://');
  }

  const isPlaceholder =
    !url ||
    url.includes('your_token') ||
    url.includes('your_redis') ||
    url.includes('YOUR_PASSWORD') ||
    url.includes('YOUR_HOST');

  return isPlaceholder ? null : url;
}

export function getRedisClient(): RedisClientLike {
  if (process.env.NODE_ENV === 'test') {
    return globalMemoryFallback;
  }

  // If circuit breaker is open, immediately return memory fallback without trying
  const now = Date.now();
  if (isRedisCircuitOpen) {
    if (now < redisCircuitCooldownUntil) {
      return globalMemoryFallback;
    }
    // Cooldown elapsed, allow one cautious attempt
    isRedisCircuitOpen = false;
  }

  if (singletonClient) {
    return singletonClient;
  }

  const url = cleanRedisUrl(process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL);
  if (!url || (!url.startsWith('redis://') && !url.startsWith('rediss://'))) {
    singletonClient = globalMemoryFallback;
    return globalMemoryFallback;
  }

  try {
    const client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (times >= 2) {
          // Trip circuit breaker on repeated failure
          isRedisCircuitOpen = true;
          redisCircuitCooldownUntil = Date.now() + 60000;
          return null; // Stop retrying
        }
        return 1000;
      },
    });

    client.on('error', (err: Error) => {
      // Trip circuit breaker immediately on network timeout or connection refused
      isRedisCircuitOpen = true;
      redisCircuitCooldownUntil = Date.now() + 60000;

      if (!hasLoggedWarning) {
        console.warn(`[Redis] Connection notice: ${(err as Error).message}. Seamlessly using in-memory store fallback.`);
        hasLoggedWarning = true;
      }

      try {
        client.disconnect(false);
      } catch {
        // ignore
      }
      singletonClient = globalMemoryFallback;
    });

    client.on('connect', () => {
      isRedisCircuitOpen = false;
      hasLoggedWarning = false;
    });

    singletonClient = client as unknown as RedisClientLike;
    return singletonClient;
  } catch (err) {
    isRedisCircuitOpen = true;
    redisCircuitCooldownUntil = Date.now() + 60000;
    if (!hasLoggedWarning) {
      console.warn(`[Redis] Initialization notice: ${(err as Error).message}. Using in-memory fallback.`);
      hasLoggedWarning = true;
    }
    singletonClient = globalMemoryFallback;
    return globalMemoryFallback;
  }
}

export const redis = getRedisClient();
export default redis;
