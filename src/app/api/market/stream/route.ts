import { NextRequest } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const redisClient = getRedisClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Live Market SSE Stream Active', timestamp: Date.now() })}\n\n`)
      );

      // Subscribe to market ticks
      try {
        redisClient.subscribe('market-ticks', (err: any) => {
          if (err) {
            console.warn('[SSE] Redis subscribe warning:', err.message);
          }
        });
      } catch (err: any) {
        console.warn('[SSE] Redis subscription setup warning:', err.message);
      }

      const messageHandler = (channel: string, message: string) => {
        if (channel === 'market-ticks') {
          try {
            controller.enqueue(encoder.encode(`data: ${message}\n\n`));
          } catch {
            // Stream may have closed
          }
        }
      };

      redisClient.on('message', messageHandler);

      // Keep-alive heartbeat every 15 seconds
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(pingInterval);
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        try {
          redisClient.removeListener('message', messageHandler);
          redisClient.unsubscribe('market-ticks');
        } catch {
          // ignore cleanup errors
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
