import { NextRequest } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { MarketService } from '@/services/marketService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const url = new URL(req.url);
  const requestedSymbols = url.searchParams.get('symbols')?.toUpperCase().split(',').map((s) => s.trim()).filter(Boolean) || [];

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
        redisClient = getRedisClient();
        redisClient.subscribe('market-ticks', () => {});
        redisClient.on('message', messageHandler);
      } catch {
        // Fallback gracefully without Redis
      }

      // 3. Real Market Tick Emitter (Polls authentic quotes for requested symbols every 5 seconds)
      const tickInterval = setInterval(async () => {
        if (isAborted) return;
        if (requestedSymbols.length === 0) return;

        for (const sym of requestedSymbols) {
          const clean = sym.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').replace(/^NSE_EQ\|/, '').trim();
          if (!clean) continue;

          try {
            const liveQuote = await MarketService.getQuote(clean);
            if (liveQuote && typeof liveQuote.ltp === 'number') {
              const tickPayload = {
                type: 'TICK',
                symbol: clean,
                ltp: liveQuote.ltp,
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
      }, 5000);

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

      req.signal.addEventListener('abort', () => {
        isAborted = true;
        clearInterval(tickInterval);
        clearInterval(pingInterval);
        if (redisClient) {
          try {
            redisClient.removeListener('message', messageHandler);
            redisClient.unsubscribe('market-ticks');
          } catch {
            // cleanup
          }
        }
      });
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

