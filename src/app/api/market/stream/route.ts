import { NextRequest } from 'next/server';
import { MarketService } from '@/services/marketService';
import { IpoService } from '@/services/ipoService';

export const dynamic = 'force-dynamic';

/**
 * Server-sent quote stream for listed IPOs. Polls the quote provider every 15 s and reports the
 * real source of every tick. Symbols with no data are skipped, never simulated.
 */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const requested =
    new URL(req.url).searchParams.get('symbols')?.toUpperCase().split(',').map((s) => s.trim()).filter(Boolean) || [];

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          closed = true;
        }
      };

      let symbols = requested.slice(0, 20);
      if (!symbols.length) {
        const listed = await IpoService.getListedIpos().catch(() => []);
        symbols = listed.slice(0, 10).map((l) => l.symbol);
      }
      send({ type: 'CONNECTED', symbols, isMock: false, timestamp: Date.now() });

      const tick = async () => {
        for (const sym of symbols) {
          if (closed) return;
          try {
            const q = await MarketService.getQuote(sym);
            send({
              type: 'TICK',
              symbol: sym,
              ltp: q.ltp,
              previousClose: q.previousClose,
              change: q.change,
              changePercent: q.changePercent,
              volume: q.volume,
              isMock: false,
              feed: q.source,
              timestamp: q.timestamp,
            });
          } catch {
            // no data for this symbol right now; skip
          }
        }
      };
      await tick();
      const tickInterval = setInterval(tick, 15000);
      const pingInterval = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          closed = true;
        }
      }, 12000);

      req.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(tickInterval);
        clearInterval(pingInterval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
