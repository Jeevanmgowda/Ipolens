import Redis from 'ioredis';
import { EventEmitter } from 'events';

// In-memory fallback for environments without Redis configured
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
}

// Global in-memory singleton fallback
const globalMemoryFallback = new InMemoryRedisEmitter();

export function getRedisClient(): any {
  let url = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL;

  if (url) {
    url = url.trim();
    if (url.startsWith('redis-cli')) {
      const match = url.match(/-u\s+([^\s]+)/);
      if (match) url = match[1];
    }
    if (url.startsWith('redis://') && url.includes('.upstash.io')) {
      url = url.replace('redis://', 'rediss://');
    }
  }

  const isPlaceholder =
    !url ||
    url.includes('your_token') ||
    url.includes('your_redis') ||
    url.includes('YOUR_PASSWORD') ||
    url.includes('YOUR_HOST');

  if (!isPlaceholder && typeof url === 'string' && (url.startsWith('redis://') || url.startsWith('rediss://'))) {
    try {
      const client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        retryStrategy: (times) => {
          if (times > 2) return null; // stop retrying and let fallback handle
          return 500;
        },
      });

      client.on('error', (err) => {
        console.warn('Redis connection warning, using fallback store:', err.message);
      });

      return client;
    } catch {
      return globalMemoryFallback;
    }
  }

  return globalMemoryFallback;
}

export const redis = getRedisClient();
export default redis;
