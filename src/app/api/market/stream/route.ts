import { NextRequest } from 'next/server';
import { getRedisSubscriber } from '@/lib/redis';
import { MarketService } from '@/lib/services/marketService';
import { getClientIp } from '@/lib/security/rateLimiter';

export const dynamic = 'force-dynamic';

// Stream limits (docs/security/BASELINE_AUDIT.md, M4). Counters are per server
// instance; the per-IP limit relies on getClientIp's trusted-proxy handling.
const MAX_SYMBOLS = 20;
const SYMBOL_PATTERN = /^[A-Z0-9&._|:-]{1,30}$/;
const MAX_STREAMS_PER_IP = 3;
const MAX_STREAMS_TOTAL = 500;
const MAX_STREAM_LIFETIME_MS = 30 * 60 * 1000;

const openStreamsByIp = new Map<string, number>();
let openStreamsTotal = 0;

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const url = new URL(req.url);
  const requestedSymbols = Array.from(
    new Set(
      (url.searchParams.get('symbols') || '')
        .toUpperCase()
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
  if (requestedSymbols.length > MAX_SYMBOLS) {
    return jsonError(400, `At most ${MAX_SYMBOLS} symbols per stream.`);
  }
  if (requestedSymbols.some((s) => !SYMBOL_PATTERN.test(s))) {
    return jsonError(400, 'Invalid symbol in symbols parameter.');
  }

  const ip = getClientIp(req);
  if (openStreamsTotal >= MAX_STREAMS_TOTAL) {
    return jsonError(503, 'Live stream capacity reached. Please retry shortly.');
  }
  if ((openStreamsByIp.get(ip) || 0) >= MAX_STREAMS_PER_IP) {
    return jsonError(429, `Too many open live streams (max ${MAX_STREAMS_PER_IP} per client).`);
  }
  openStreamsByIp.set(ip, (openStreamsByIp.get(ip) || 0) + 1);
  openStreamsTotal++;

  let released = false;
  const releaseSlot = () => {
    if (released) return;
    released = true;
    openStreamsTotal = Math.max(0, openStreamsTotal - 1);
    const left = (openStreamsByIp.get(ip) || 1) - 1;
    if (left <= 0) openStreamsByIp.delete(ip);
    else openStreamsByIp.set(ip, left);
  };

  const stream = new ReadableStream({
    start(controller) {
      let isAborted = false;

      // 1. Send initial connection confirmation
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: 'CONNECTED',
            message: 'Real-Time Market Data Stream Active (Live Exchange)',
            isMock: MarketService.isMockMode(),
            timestamp: Date.now(),
          })}\n\n`
        )
      );

      // 2. Redis integration (if Redis Pub/Sub is active)
      let redisClient: any = null;
      const messageHandler = (channel: string, message: string) => {
        if (!isAborted && channel === 'market-ticks') {
          try {
            controller.enqueue(encoder.encode(`data: ${message}\n\n`));
          } catch {
            // Stream closed
          }
        }
      };

      try {
        redisClient = getRedisSubscriber();
        redisClient.subscribe('market-ticks', () => {});
        redisClient.on('message', messageHandler);
      } catch {
        // Fallback gracefully without Redis
      }

      // 3. Real Market Tick Emitter (Polls authentic quotes for requested or listed IPOs every 8 seconds)
      const tickInterval = setInterval(async () => {
        if (isAborted) return;

        let targetSymbols = requestedSymbols;
        if (targetSymbols.length === 0) {
          try {
            const { LISTED_IPOS_REGISTRY } = await import('@/lib/services/listedIpoService');
            targetSymbols = LISTED_IPOS_REGISTRY.slice(0, 10).map((l) => l.symbol);
          } catch {
            targetSymbols = ['SWIGGY', 'HYUNDAI', 'BAJAJHFL', 'TATATECH', 'PREMIERENE', 'KRN', 'NETWEB', 'DOMS', 'WAAREEENER'];
          }
        }

        for (const sym of targetSymbols) {
          if (isAborted) break;
          const clean = sym.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').replace(/^NSE_EQ\|/, '').trim();
          if (!clean) continue;

          try {
            const liveQuote = await MarketService.getQuote(clean);
            if (liveQuote && typeof liveQuote.ltp === 'number') {
              const tickPayload = {
                type: 'TICK',
                symbol: clean,
                ltp: liveQuote.ltp,
                previousClose: liveQuote.previousClose,
                change: liveQuote.change,
                changePercent: liveQuote.changePercent,
                volume: liveQuote.volume,
                isMock: false,
                feed: 'NSE_LIVE_EXCHANGE',
                timestamp: liveQuote.timestamp || new Date().toISOString(),
              };

              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(tickPayload)}\n\n`));
              } catch {
                isAborted = true;
              }
            }
          } catch {
            // ignore network glitch
          }
        }
      }, 8000);

      // Keep-alive heartbeat ping every 12 seconds
      const pingInterval = setInterval(() => {
        if (isAborted) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          isAborted = true;
          clearInterval(pingInterval);
        }
      }, 12000);

      const shutdown = () => {
        if (isAborted && released) return;
        isAborted = true;
        clearInterval(tickInterval);
        clearInterval(pingInterval);
        clearTimeout(lifetimeTimer);
        if (redisClient) {
          try {
            // Only detach this stream's listener. The Redis client is shared by every
            // open stream, so unsubscribing here would silence all the others.
            redisClient.removeListener('message', messageHandler);
          } catch {
            // cleanup
          }
        }
        releaseSlot();
      };

      // Cap connection lifetime; EventSource clients reconnect automatically.
      const lifetimeTimer = setTimeout(() => {
        shutdown();
        try {
          controller.close();
        } catch {
          // already closed
        }
      }, MAX_STREAM_LIFETIME_MS);

      req.signal.addEventListener('abort', shutdown);
    },
    cancel() {
      releaseSlot();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

