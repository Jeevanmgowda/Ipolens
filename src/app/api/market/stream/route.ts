import { NextRequest } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { MarketService } from '@/services/marketService';

export const dynamic = 'force-dynamic';

// Benchmark price dictionary for instant real-time tick streaming
const LIVE_PRICES: Record<string, { price: number; prevClose: number; volume: number }> = {
  SWIGGY: { price: 256.00, prevClose: 256.00, volume: 11465500 },
  HYUNDAI: { price: 2050.70, prevClose: 2050.70, volume: 540000 },
  BAJAJHFL: { price: 82.52, prevClose: 82.52, volume: 2875700 },
  PREMIERENE: { price: 906.00, prevClose: 906.00, volume: 1041400 },
  KRN: { price: 1387.40, prevClose: 1420.10, volume: 620400 },
  NETWEB: { price: 4566.50, prevClose: 4817.00, volume: 450200 },
  TATATECH: { price: 707.05, prevClose: 707.05, volume: 880600 },
  KAYNES: { price: 3658.00, prevClose: 3455.00, volume: 982650 },
  IREDA: { price: 114.82, prevClose: 114.82, volume: 17078700 },
  DOMS: { price: 2045.00, prevClose: 2045.00, volume: 380200 },
  WAAREE: { price: 2540.00, prevClose: 2500.00, volume: 1250000 },
  MANIKAPLAS: { price: 48.50, prevClose: 43.00, volume: 750000 },
  VEEGALDEVE: { price: 162.40, prevClose: 154.00, volume: 540000 },
};

// Open IPO subscription state dictionary
const OPEN_SUBSCRIPTIONS: Record<string, { total: number; qib: number; nii: number; retail: number }> = {
  MONEYVIEW: { total: 73.04, qib: 105.91, nii: 52.40, retail: 22.10 },
  ROOPASCRE: { total: 18.42, qib: 24.10, nii: 16.50, retail: 12.80 },
  ORIENTCABL: { total: 31.60, qib: 42.50, nii: 28.30, retail: 19.40 },
  HELIOS: { total: 24.15, qib: 41.20, nii: 32.40, retail: 16.30 },
};

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const url = new URL(req.url);
  const requestedSymbols = url.searchParams.get('symbols')?.toUpperCase().split(',').map((s) => s.trim()) || [];

  const stream = new ReadableStream({
    start(controller) {
      let isAborted = false;

      // 1. Send initial connection confirmation
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: 'CONNECTED',
            message: 'Real-Time Market & Subscription Stream Active',
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

      // 3. Native Active Real-Time Tick Emitter (Emits ticks every 2 seconds)
      const tickInterval = setInterval(async () => {
        if (isAborted) return;

        // A. Secondary Listed Stock Ticks
        const symbolsToTick = requestedSymbols.length > 0 && requestedSymbols[0] !== ''
          ? requestedSymbols
          : Object.keys(LIVE_PRICES);

        // Pick 2-3 symbols per tick cycle to simulate real exchange order matching
        const randomPicks = [...symbolsToTick].sort(() => 0.5 - Math.random()).slice(0, 3);

        for (const sym of randomPicks) {
          const clean = sym.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '');
          let ltp: number = 0;
          let change: number = 0;
          let changePercent: number = 0;
          let volume: number = 0;
          let isMockFeed = true;

          if (!MarketService.isMockMode()) {
            try {
              const liveQuote = await MarketService.getQuote(clean);
              if (liveQuote && !liveQuote.isMock) {
                ltp = liveQuote.ltp;
                change = liveQuote.change;
                changePercent = liveQuote.changePercent;
                volume = liveQuote.volume;
                isMockFeed = false;
              }
            } catch {
              // fallback
            }
          }

          if (isMockFeed) {
            const existing = LIVE_PRICES[clean] || { price: 500, prevClose: 490, volume: 100000 };
            const pctDelta = (Math.random() * 0.4 - 0.19) / 100;
            const newPrice = Number((existing.price * (1 + pctDelta)).toFixed(2));
            change = Number((newPrice - existing.prevClose).toFixed(2));
            changePercent = Number(((change / existing.prevClose) * 100).toFixed(2));
            existing.volume += Math.floor(Math.random() * 120 + 10);
            existing.price = newPrice;
            ltp = newPrice;
            volume = existing.volume;
          }

          const tickPayload = {
            type: 'TICK',
            symbol: clean,
            ltp,
            change,
            changePercent,
            volume,
            isMock: isMockFeed,
            feed: isMockFeed ? 'SIMULATOR' : 'UPSTOX_NSE',
            timestamp: new Date().toISOString(),
          };

          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(tickPayload)}\n\n`));
          } catch {
            isAborted = true;
          }
        }

        // B. Primary Open IPO Subscription Progress Ticks (every few cycles)
        if (Math.random() > 0.4) {
          const openKeys = Object.keys(OPEN_SUBSCRIPTIONS);
          const chosenOpen = openKeys[Math.floor(Math.random() * openKeys.length)];
          const sub = OPEN_SUBSCRIPTIONS[chosenOpen];
          if (sub) {
            sub.total = Number((sub.total + Math.random() * 0.08).toFixed(2));
            sub.qib = Number((sub.qib + Math.random() * 0.12).toFixed(2));
            sub.retail = Number((sub.retail + Math.random() * 0.04).toFixed(2));
            sub.nii = Number((sub.nii + Math.random() * 0.06).toFixed(2));

            const subPayload = {
              type: 'SUBSCRIPTION_UPDATE',
              symbol: chosenOpen,
              currentSubscription: sub.total,
              qib: sub.qib,
              nii: sub.nii,
              retail: sub.retail,
              timestamp: new Date().toISOString(),
            };

            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(subPayload)}\n\n`));
            } catch {
              isAborted = true;
            }
          }
        }
      }, 2000);

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
