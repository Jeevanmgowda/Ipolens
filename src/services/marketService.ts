import { MarketQuoteData, MarketOhlcCandle, MarketStatus } from '@/types/liveMarket';
import { MarketDataProvider, UpstoxProvider, MockMarketProvider } from './marketDataProvider';
import { LISTED_IPOS_REGISTRY } from './listedIpoService';
import { redis } from '@/lib/redis';

export class MarketService {
  private static upstoxProvider = new UpstoxProvider();
  private static mockProvider = new MockMarketProvider();

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

    try {
      const provider = this.getProvider();
      const quote = await provider.getQuote(clean);

      // Cache quote in Redis for sub-second responses
      try {
        await redis.set(`market:quote:${clean}`, JSON.stringify(quote), 'EX', 15);
      } catch {
        // In-memory fallback handles silently
      }

      return quote;
    } catch (err: any) {
      if (this.isMockMode()) {
        return this.mockProvider.getQuote(clean);
      }
      const registered = LISTED_IPOS_REGISTRY.find((l) => l.symbol.toUpperCase() === clean);
      if (registered) {
        const ltp = registered.listingPrice;
        const prevClose = registered.issuePrice;
        const change = Number((ltp - prevClose).toFixed(2));
        const changePercent = prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;
        return {
          symbol: clean,
          ltp,
          open: ltp,
          high: Math.max(ltp, prevClose),
          low: Math.min(ltp, prevClose),
          previousClose: prevClose,
          volume: 0,
          change,
          changePercent,
          timestamp: new Date().toISOString(),
          isMock: false,
        };
      }
      console.warn(`[MarketService] Provider error for ${clean}:`, err.message);
      throw err;
    }
  }

  /**
   * Fetch OHLC candles for specified timeframe
   */
  static async getOhlc(symbol: string, timeframe: string = '1D'): Promise<MarketOhlcCandle[]> {
    const clean = symbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').trim();

    try {
      const provider = this.getProvider();
      return await provider.getOhlc(clean, timeframe);
    } catch (err: any) {
      if (this.isMockMode()) {
        return this.mockProvider.getOhlc(clean, timeframe);
      }
      console.warn(`[MarketService] Provider OHLC error for ${clean}, chart unavailable:`, err.message);
      return [];
    }
  }
}
