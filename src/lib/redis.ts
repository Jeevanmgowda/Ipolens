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

  async set(key: string, value: string, mode?: string, duration?: number): Promise<string> {
    let expiry: number | undefined = undefined;
    if (mode === 'EX' && typeof duration === 'number') {
      expiry = Date.now() + duration * 1000;
    } else if (mode === 'PX' && typeof duration === 'number') {
      expiry = Date.now() + duration;
    }
    this.store.set(key, { value, expiry });
    return 'OK';
  }

  async publish(channel: string, message: string): Promise<number> {
    this.emit('message', channel, message);
    return 1;
  }

  async subscribe(channel: string, cb?: (err: Error | null, count?: number) => void): Promise<number> {
    if (cb) cb(null, 1);
    return 1;
  }

  async unsubscribe(channel: string): Promise<number> {
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

// Global in-memory singleton fallback
const globalMemoryFallback = new InMemoryRedisEmitter();

let singletonClient: any = null;
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

export function getRedisClient(): any {
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

    client.on('error', (err: any) => {
      // Trip circuit breaker immediately on network timeout or connection refused
      isRedisCircuitOpen = true;
      redisCircuitCooldownUntil = Date.now() + 60000;

      if (!hasLoggedWarning) {
        console.warn(`[Redis] Connection notice: ${err.message}. Seamlessly using in-memory store fallback.`);
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

    singletonClient = client;
    return client;
  } catch (err: any) {
    isRedisCircuitOpen = true;
    redisCircuitCooldownUntil = Date.now() + 60000;
    if (!hasLoggedWarning) {
      console.warn(`[Redis] Initialization notice: ${err.message}. Using in-memory fallback.`);
      hasLoggedWarning = true;
    }
    singletonClient = globalMemoryFallback;
    return globalMemoryFallback;
  }
}

export const redis = getRedisClient();
export default redis;
