import { MarketQuoteData, MarketOhlcCandle } from '@/types/liveMarket';
import { LISTED_IPOS_REGISTRY } from './listedIpoService';

export interface MarketDataProvider {
  name: string;
  getQuote(symbol: string): Promise<MarketQuoteData>;
  getOhlc(symbol: string, timeframe?: string): Promise<MarketOhlcCandle[]>;
}

/**
 * Upstox Market Data Provider (V3 API)
 * Official broker integration for live streaming LTP, OHLC, and market depth.
 */
export class UpstoxProvider implements MarketDataProvider {
  name = 'Upstox V3 Market Data Feed';

  private clientId: string;
  private clientSecret: string;
  private accessToken: string;
  private baseUrl = 'https://api.upstox.com/v2';
  private mockFallback = new MockMarketProvider();

  constructor() {
    this.clientId = process.env.UPSTOX_CLIENT_ID || '';
    this.clientSecret = process.env.UPSTOX_CLIENT_SECRET || '';
    this.accessToken = process.env.UPSTOX_ACCESS_TOKEN || '';
  }

  isConfigured(): boolean {
    return (
      Boolean(this.accessToken) &&
      !this.accessToken.includes('your_') &&
      !this.accessToken.includes('YOUR_') &&
      this.accessToken.length > 20
    );
  }

  isAvailable(): boolean {
    return this.isConfigured();
  }

  async getQuote(symbol: string): Promise<MarketQuoteData> {
    if (!this.isConfigured()) {
      return this.mockFallback.getQuote(symbol);
    }

    const cleanSymbol = symbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '');
    const instrumentKey = `NSE_EQ|${cleanSymbol}`;

    const res = await fetch(`${this.baseUrl}/market-quote/quotes?instrument_key=${encodeURIComponent(instrumentKey)}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Upstox HTTP ${res.status}: Failed to fetch market quote`);
    }

    const json = await res.json();
    const data = json.data?.[instrumentKey];
    if (!data) {
      throw new Error(`No quote data returned from Upstox for ${cleanSymbol}`);
    }

    const ltp = Number(data.last_price || data.ohlc?.close || 0);
    const prevClose = Number(data.prev_close || data.ohlc?.close || ltp);
    const change = Number((ltp - prevClose).toFixed(2));
    const changePercent = prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;

    return {
      symbol: cleanSymbol,
      ltp,
      open: Number(data.ohlc?.open || ltp),
      high: Number(data.ohlc?.high || ltp),
      low: Number(data.ohlc?.low || ltp),
      previousClose: prevClose,
      volume: Number(data.volume || 0),
      change,
      changePercent,
      timestamp: new Date().toISOString(),
      isMock: false,
    };
  }

  async getOhlc(symbol: string, timeframe: string = '1D'): Promise<MarketOhlcCandle[]> {
    if (!this.isConfigured()) {
      return this.mockFallback.getOhlc(symbol, timeframe);
    }

    const cleanSymbol = symbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '');
    const instrumentKey = `NSE_EQ|${cleanSymbol}`;

    // Map timeframe to Upstox historical interval
    let unit = 'day';
    let interval = '1';
    if (timeframe === '1m') { unit = 'minute'; interval = '1'; }
    else if (timeframe === '5m') { unit = 'minute'; interval = '5'; }
    else if (timeframe === '15m') { unit = 'minute'; interval = '15'; }
    else if (timeframe === '30m') { unit = 'minute'; interval = '30'; }
    else if (timeframe === '1H') { unit = 'minute'; interval = '60'; }
    else if (timeframe === '1W') { unit = 'week'; interval = '1'; }
    else if (timeframe === '1M') { unit = 'month'; interval = '1'; }

    const toDate = new Date().toISOString().split('T')[0];
    const fromDateObj = new Date();
    fromDateObj.setDate(fromDateObj.getDate() - 30);
    const fromDate = fromDateObj.toISOString().split('T')[0];

    const url = `${this.baseUrl}/historical-candle/${encodeURIComponent(instrumentKey)}/${unit}/${interval}/${toDate}/${fromDate}`;

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Upstox HTTP ${res.status}: Failed to fetch historical candles`);
    }

    const json = await res.json();
    const candles = json.data?.candles || [];

    return candles.map((c: any[]) => ({
      time: String(c[0]),
      timestamp: new Date(c[0]).getTime(),
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5] || 0),
    }));
  }
}

/**
 * Mock Market Provider for Free Development & Offline Mode
 * Generates realistic price fluctuations, OHLC candles, and volume without requiring paid broker API keys.
 */
export class MockMarketProvider implements MarketDataProvider {
  name = 'Demo Market Simulator';

  // Base pricing registry for benchmark Indian IPOs
  private basePrices: Record<string, { price: number; issue: number; prevClose: number }> = {
    'SWIGGY': { price: 412.50, issue: 390, prevClose: 405.00 },
    'HYUNDAI': { price: 1845.20, issue: 1960, prevClose: 1832.00 },
    'BAJAJHFL': { price: 142.80, issue: 70, prevClose: 139.50 },
    'PREMIERENE': { price: 1120.40, issue: 450, prevClose: 1088.00 },
    'KRN': { price: 540.60, issue: 220, prevClose: 528.00 },
    'NETWEB': { price: 2650.00, issue: 500, prevClose: 2590.00 },
    'TATATECH': { price: 980.50, issue: 500, prevClose: 975.00 },
    'IREDA': { price: 215.30, issue: 32, prevClose: 212.00 },
    'DOMS': { price: 2480.00, issue: 790, prevClose: 2440.00 },
    'NIFTY': { price: 25385.20, issue: 20000, prevClose: 25265.00 },
  };

  async getQuote(symbol: string): Promise<MarketQuoteData> {
    const clean = symbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').trim();
    const listed = LISTED_IPOS_REGISTRY.find((l) => l.symbol.toUpperCase() === clean);

    const base = this.basePrices[clean] || {
      price: listed ? listed.listingPrice * 1.2 : 450,
      issue: listed ? listed.issuePrice : 350,
      prevClose: listed ? listed.listingPrice * 1.18 : 442,
    };

    // Add gentle intraday random walk variance (±0.8%)
    const randomFactor = (Math.random() - 0.48) * 0.016;
    const ltp = Number((base.price * (1 + randomFactor)).toFixed(2));
    const prevClose = base.prevClose;
    const change = Number((ltp - prevClose).toFixed(2));
    const changePercent = Number(((change / prevClose) * 100).toFixed(2));

    const high = Number((Math.max(ltp, prevClose) * 1.015).toFixed(2));
    const low = Number((Math.min(ltp, prevClose) * 0.985).toFixed(2));
    const open = Number((prevClose * 1.002).toFixed(2));
    const volume = Math.floor(850000 + Math.random() * 450000);

    return {
      symbol: clean,
      ltp,
      open,
      high,
      low,
      previousClose: prevClose,
      volume,
      change,
      changePercent,
      timestamp: new Date().toISOString(),
      isMock: true,
    };
  }

  async getOhlc(symbol: string, timeframe: string = '1D'): Promise<MarketOhlcCandle[]> {
    const clean = symbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').trim();
    const quote = await this.getQuote(clean);

    let count = 30;
    let stepMs = 24 * 60 * 60 * 1000; // 1 day

    if (timeframe === '1m') { count = 30; stepMs = 60 * 1000; }
    else if (timeframe === '5m') { count = 35; stepMs = 5 * 60 * 1000; }
    else if (timeframe === '15m') { count = 30; stepMs = 15 * 60 * 1000; }
    else if (timeframe === '30m') { count = 30; stepMs = 30 * 60 * 1000; }
    else if (timeframe === '1H') { count = 24; stepMs = 60 * 60 * 1000; }
    else if (timeframe === '1D') { count = 30; stepMs = 24 * 60 * 60 * 1000; }
    else if (timeframe === '1W') { count = 26; stepMs = 7 * 24 * 60 * 60 * 1000; }
    else if (timeframe === '1M') { count = 12; stepMs = 30 * 24 * 60 * 60 * 1000; }

    const now = Date.now();
    const candles: MarketOhlcCandle[] = [];
    let currentPrice = quote.ltp * (1 - count * 0.005);

    for (let i = count - 1; i >= 0; i--) {
      const timeMs = now - i * stepMs;
      const dateObj = new Date(timeMs);
      
      const changePercent = (Math.random() - 0.48) * 0.03;
      const open = Number(currentPrice.toFixed(2));
      const close = Number((open * (1 + changePercent)).toFixed(2));
      const high = Number((Math.max(open, close) * (1 + Math.random() * 0.012)).toFixed(2));
      const low = Number((Math.min(open, close) * (1 - Math.random() * 0.012)).toFixed(2));
      const volume = Math.floor(40000 + Math.random() * 95000);

      const timeLabel = ['1m', '5m', '15m', '30m', '1H'].includes(timeframe)
        ? dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

      candles.push({
        time: timeLabel,
        timestamp: timeMs,
        open,
        high,
        low,
        close,
        volume,
      });

      currentPrice = close;
    }

    return candles;
  }
}
