import { SmartWebSocketV2 } from 'smartapi-javascript';
import { redis } from '../src/lib/redis';
import { SymbolTokenService } from '../src/lib/services/symbol-token.service';

export interface MarketFeedWorkerOptions {
  clientCode?: string;
  feedToken?: string;
  apiKey?: string;
  tokens?: string[];
}

/**
 * Background worker that connects to Angel One SmartAPI WebSocket V2,
 * subscribes to listing-day tokens, caches LTP in Redis, and publishes ticks.
 */
export function startLivePriceWorker(
  clientCode = process.env.ANGEL_ONE_CLIENT_CODE || 'DEMO_CLIENT',
  feedToken = process.env.ANGEL_ONE_FEED_TOKEN || 'DEMO_FEED_TOKEN',
  apiKey = process.env.ANGEL_ONE_API_KEY || 'DEMO_API_KEY',
  customTokens?: string[]
) {
  const tokensToSubscribe = customTokens && customTokens.length > 0
    ? customTokens
    : SymbolTokenService.getAllTokens().slice(0, 10);

  console.log(`[MarketFeedWorker] Initializing with ${tokensToSubscribe.length} tokens...`);

  let ws: any = null;

  try {
    ws = new SmartWebSocketV2({
      jwttoken: feedToken,
      apikey: apiKey,
      clientcode: clientCode,
      feedtype: 'order_feed',
    });

    ws.connect()
      .then(() => {
        console.log('[MarketFeedWorker] Connected to Angel One WebSocket V2.');
        // Mode 1: LTP, Mode 2: Quote, Mode 3: SnapQuote
        ws.fetchData({
          correlationID: 'ipolens_feed_01',
          action: 1, // 1: Subscribe
          mode: 1,   // LTP mode
          exchangeType: 1, // 1: NSE Equity
          tokens: tokensToSubscribe,
        });
      })
      .catch((err: any) => {
        console.warn('[MarketFeedWorker] WS connect notice (using simulated tick stream if offline):', err.message);
        startSimulatedTickStream(tokensToSubscribe);
      });

    ws.on('tick', async (data: any) => {
      try {
        const { token, last_traded_price } = data;
        if (token && last_traded_price) {
          const ltp = (last_traded_price / 100).toFixed(2);
          const mapping = SymbolTokenService.getSymbolByToken(String(token));
          const symbol = mapping ? mapping.symbol : token;

          // 1. Cache in Redis for sub-second retrieval
          await redis.set(`quote:${token}`, ltp, 'EX', 3600);
          await redis.set(`ipo:live:${symbol}`, JSON.stringify({ symbol, token, ltp, timestamp: Date.now() }), 'EX', 3600);

          // 2. Publish to client-facing pub/sub channel
          await redis.publish(
            'market-ticks',
            JSON.stringify({ token, symbol, ltp: parseFloat(ltp), timestamp: Date.now() })
          );
        }
      } catch (err) {
        console.error('[MarketFeedWorker] Error handling tick:', err);
      }
    });

    ws.on('error', (err: any) => {
      console.warn('[MarketFeedWorker] WebSocket error:', err.message);
    });
  } catch (err: any) {
    console.warn('[MarketFeedWorker] SmartWebSocketV2 initialization notice:', err.message);
    startSimulatedTickStream(tokensToSubscribe);
  }

  return ws;
}

// Simulated real-time tick emitter when broker credentials are not active
let simInterval: NodeJS.Timeout | null = null;

function startSimulatedTickStream(tokens: string[]) {
  if (simInterval) return;

  console.log('[MarketFeedWorker] Starting simulated market tick stream across tokens...');
  simInterval = setInterval(async () => {
    const randomToken = tokens[Math.floor(Math.random() * tokens.length)];
    const mapping = SymbolTokenService.getSymbolByToken(randomToken);
    const symbol = mapping ? mapping.symbol : randomToken;

    // Small random price fluctuation between 80 and 2500
    const basePrice = symbol === 'SWIGGY' ? 273 : symbol === 'TATATECH' ? 722 : symbol === 'BAJAJHFL' ? 85 : 450;
    const delta = (Math.random() * 2 - 1) * 0.75;
    const ltp = (basePrice + delta).toFixed(2);

    await redis.set(`quote:${randomToken}`, ltp, 'EX', 3600);
    await redis.publish(
      'market-ticks',
      JSON.stringify({ token: randomToken, symbol, ltp: parseFloat(ltp), timestamp: Date.now() })
    );
  }, 4000);
}

export function stopLivePriceWorker() {
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
}
