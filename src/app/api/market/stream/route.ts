import { NextRequest } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// Benchmark price dictionary for instant real-time tick streaming
const LIVE_PRICES: Record<string, { price: number; prevClose: number; volume: number }> = {
  SWIGGY: { price: 412.50, prevClose: 405.00, volume: 1420500 },
  HYUNDAI: { price: 1845.20, prevClose: 1832.00, volume: 890400 },
  BAJAJHFL: { price: 142.80, prevClose: 139.50, volume: 5420100 },
  PREMIERENE: { price: 1120.40, prevClose: 1088.00, volume: 1650300 },
  KRN: { price: 1387.40, prevClose: 1420.10, volume: 620400 },
  NETWEB: { price: 4566.50, prevClose: 4817.00, volume: 450200 },
  TATATECH: { price: 980.50, prevClose: 975.00, volume: 2150800 },
  KAYNES: { price: 3658.00, prevClose: 3455.00, volume: 982650 },
  IREDA: { price: 215.30, prevClose: 212.00, volume: 8450100 },
  DOMS: { price: 2480.00, prevClose: 2440.00, volume: 380200 },
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
      const tickInterval = setInterval(() => {
        if (isAborted) return;

        // A. Secondary Listed Stock Ticks
        const symbolsToTick = requestedSymbols.length > 0 && requestedSymbols[0] !== ''
          ? requestedSymbols
          : Object.keys(LIVE_PRICES);

        // Pick 2-3 symbols per tick cycle to simulate real exchange order matching
        const randomPicks = [...symbolsToTick].sort(() => 0.5 - Math.random()).slice(0, 3);

        randomPicks.forEach((sym) => {
          const clean = sym.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '');
          const existing = LIVE_PRICES[clean] || { price: 500, prevClose: 490, volume: 100000 };

          // Micro-fluctuation: ±0.05% to ±0.25%
          const pctDelta = (Math.random() * 0.5 - 0.24) / 100;
          const newPrice = Number((existing.price * (1 + pctDelta)).toFixed(2));
          const change = Number((newPrice - existing.prevClose).toFixed(2));
          const changePercent = Number(((change / existing.prevClose) * 100).toFixed(2));
          existing.volume += Math.floor(Math.random() * 120 + 10);
          existing.price = newPrice;

          const tickPayload = {
            type: 'TICK',
            symbol: clean,
            ltp: newPrice,
            change,
            changePercent,
            volume: existing.volume,
            timestamp: new Date().toISOString(),
          };

          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(tickPayload)}\n\n`));
          } catch {
            isAborted = true;
          }
        });

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
