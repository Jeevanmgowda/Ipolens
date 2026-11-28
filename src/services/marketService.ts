import { MarketQuoteData, MarketOhlcCandle, MarketStatus } from '@/types/liveMarket';
import { MarketDataProvider, UpstoxProvider, MockMarketProvider } from './marketDataProvider';
import { redis } from '@/lib/redis';

export class MarketService {
  private static upstoxProvider = new UpstoxProvider();
  private static mockProvider = new MockMarketProvider();
  private static quoteMemoryCache = new Map<string, { data: MarketQuoteData; expiry: number }>();

  /**
   * Determine whether the service should run in simulated mock mode
   */
  static isMockMode(): boolean {
    return process.env.USE_MOCK_MARKET_DATA === 'true';
  }

  /**
   * Returns current active data provider instance
   */
  static getProvider(): MarketDataProvider {
    if (!this.isMockMode()) {
      return this.upstoxProvider;
    }
    return this.mockProvider;
  }

  /**
   * Determines if Indian Stock Exchanges (NSE/BSE) are currently OPEN
   * Trading hours: 09:15 to 15:30 IST, Monday through Friday
   */
  static getMarketStatus(): MarketStatus {
    const now = new Date();
    // Convert to IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + now.getTimezoneOffset() * 60 * 1000 + istOffset);

    const day = istDate.getDay(); // 0 is Sunday, 6 is Saturday
    if (day === 0 || day === 6) {
      return 'CLOSED';
    }

    const hour = istDate.getHours();
    const minute = istDate.getMinutes();
    const timeMinutes = hour * 60 + minute;

    // 09:15 is 9*60+15 = 555; 15:30 is 15*60+30 = 930
    if (timeMinutes >= 555 && timeMinutes <= 930) {
      return 'OPEN';
    }

    return 'CLOSED';
  }

  /**
   * Fetch live quote with caching and fallback
   */
  static async getQuote(symbol: string): Promise<MarketQuoteData> {
    const clean = symbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').trim();

    // 1. Check in-memory quote cache (15s TTL)
    const memCached = this.quoteMemoryCache.get(clean);
    if (memCached && Date.now() < memCached.expiry) {
      return memCached.data;
    }

    // 2. Check Redis quote cache
    try {
      const cached = await redis.get(`market:quote:${clean}`);
      if (cached) {
        const parsed = JSON.parse(cached) as MarketQuoteData;
        this.quoteMemoryCache.set(clean, { data: parsed, expiry: Date.now() + 15000 });
        return parsed;
      }
    } catch {
      // Redis optional
    }

    try {
      const provider = this.getProvider();
      const quote = await provider.getQuote(clean);

      this.quoteMemoryCache.set(clean, { data: quote, expiry: Date.now() + 15000 });

      // Cache quote in Redis for sub-second responses
      try {
        await redis.set(`market:quote:${clean}`, JSON.stringify(quote), 'EX', 15);
      } catch {
        // In-memory fallback handles silently
      }

      return quote;
    } catch (err) {
      if (this.isMockMode()) {
        return this.mockProvider.getQuote(clean);
      }
      // No exchange data: report it rather than inventing a price.
      throw err;
    }
  }

  /**
   * Fetch OHLC candles for specified timeframe
   */
  static async getOhlc(symbol: string, timeframe: string = '1D'): Promise<MarketOhlcCandle[]> {
    const clean = symbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').trim();

    if (this.isMockMode()) return this.mockProvider.getOhlc(clean, timeframe);
    try {
      return (await this.getProvider().getOhlc(clean, timeframe)) ?? [];
    } catch {
      return [];
    }
  }
}
