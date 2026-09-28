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

  private isinMap: Record<string, string> = {
    SWIGGY: 'NSE_EQ|INE00H001014',
    HYUNDAI: 'NSE_EQ|INE0V6F01027',
    BAJAJHFL: 'NSE_EQ|INE377Y01014',
    PREMIERENE: 'NSE_EQ|INE0BS701011',
    KRN: 'NSE_EQ|INE0Q3J01015',
    NETWEB: 'NSE_EQ|INE0NT901020',
    TATATECH: 'NSE_EQ|INE142M01025',
    IREDA: 'NSE_EQ|INE202E01016',
    DOMS: 'NSE_EQ|INE321T01012',
    JYOTICNC: 'NSE_EQ|INE980O01024',
    MANKIND: 'NSE_EQ|INE634S01028',
    DEEDEV: 'NSE_EQ|INE841L01016',
    CONCORDBIO: 'NSE_EQ|INE338H01029',
    NORTHARC: 'NSE_EQ|INE850M01015',
    ARKADE: 'NSE_EQ|INE0QRL01017',
    WCIL: 'NSE_EQ|INE0CJF01024',
    SBFC: 'NSE_EQ|INE423Y01016',
    KAYNES: 'NSE_EQ|INE918Z01012',
    FIRSTCRY: 'NSE_EQ|INE02RE01045',
    OLAELEC: 'NSE_EQ|INE0LXG01040',
    SANSTAR: 'NSE_EQ|INE08NE01025',
    BANSALWIRE: 'NSE_EQ|INE0B9K01025',
    EMCURE: 'NSE_EQ|INE168P01015',
    AKUMS: 'NSE_EQ|INE09XN01023',
    CEIGALL: 'NSE_EQ|INE0AG901020',
    WAAREE: 'NSE_EQ|INE377N01017',
    WAAREEENER: 'NSE_EQ|INE377N01017',
    GARUDA: 'NSE_EQ|INE0JVO01026',
    PAYTM: 'NSE_EQ|INE982J01020',
    ZOMATO: 'NSE_EQ|INE758T01015',
    ETERNAL: 'NSE_EQ|INE758T01015',
    RELIANCE: 'NSE_EQ|INE002A01018',
    TCS: 'NSE_EQ|INE467B01029',
    INFY: 'NSE_EQ|INE009A01021',
    HDFCBANK: 'NSE_EQ|INE040A01034',
    ICICIBANK: 'NSE_EQ|INE090A01021',
    SBIN: 'NSE_EQ|INE062A01020',
    BHARTIARTL: 'NSE_EQ|INE397D01024',
    ITC: 'NSE_EQ|INE154A01025',
    LT: 'NSE_EQ|INE018A01030',
    NIFTY: 'NSE_INDEX|Nifty 50',
    'NIFTY 50': 'NSE_INDEX|Nifty 50',
  };

  resolveInstrumentKey(cleanSymbol: string): string {
    const upper = cleanSymbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').trim();
    if (upper === 'NIFTY' || upper === 'NIFTY 50') return 'NSE_INDEX|Nifty 50';
    if (upper.startsWith('NSE_EQ|') || upper.startsWith('NSE_INDEX|')) return upper;
    if (upper.startsWith('INE')) return `NSE_EQ|${upper}`;
    if (this.isinMap[upper]) return this.isinMap[upper];
    return `NSE_EQ|${upper}`;
  }

  async getQuote(symbol: string): Promise<MarketQuoteData> {
    if (!this.isConfigured()) {
      return this.mockFallback.getQuote(symbol);
    }

    const cleanSymbol = symbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').trim();
    const instrumentKey = this.resolveInstrumentKey(cleanSymbol);

    try {
      const res = await fetch(`${this.baseUrl}/market-quote/quotes?instrument_key=${encodeURIComponent(instrumentKey)}`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!res.ok) {
        console.warn(`[Upstox] HTTP ${res.status} on quote for ${cleanSymbol}, falling back to mock.`);
        return this.mockFallback.getQuote(symbol);
      }

      const json = await res.json();
      const colonKey = instrumentKey.replace('|', ':');
      const data = json.data?.[colonKey]
        || json.data?.[instrumentKey]
        || json.data?.[`NSE_EQ:${cleanSymbol}`]
        || json.data?.[`NSE_INDEX:${cleanSymbol}`]
        || Object.values(json.data || {})[0];

      if (!data) {
        console.warn(`[Upstox] No quote data returned for ${cleanSymbol} (${instrumentKey}), using fallback.`);
        return this.mockFallback.getQuote(symbol);
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
    } catch (err: any) {
      console.warn(`[Upstox] Error on quote: ${err.message}, using fallback.`);
      return this.mockFallback.getQuote(symbol);
    }
  }

  async getOhlc(symbol: string, timeframe: string = '1D'): Promise<MarketOhlcCandle[]> {
    if (!this.isConfigured()) {
      return this.mockFallback.getOhlc(symbol, timeframe);
    }

    const cleanSymbol = symbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').trim();
    const instrumentKey = this.resolveInstrumentKey(cleanSymbol);
    const isIntraday = ['1m', '5m', '15m', '30m', '1H'].includes(timeframe);

    let url: string;
    if (isIntraday) {
      const interval = (timeframe === '30m' || timeframe === '1H') ? '30minute' : '1minute';
      url = `${this.baseUrl}/historical-candle/intraday/${encodeURIComponent(instrumentKey)}/${interval}`;
    } else {
      let intervalStr = 'day';
      let daysBack = 180;
      if (timeframe === '1W') {
        intervalStr = 'week';
        daysBack = 365;
      } else if (timeframe === '1M') {
        intervalStr = 'month';
        daysBack = 1000;
      }

      const toDate = new Date().toISOString().split('T')[0];
      const fromDateObj = new Date();
      fromDateObj.setDate(fromDateObj.getDate() - daysBack);
      const fromDate = fromDateObj.toISOString().split('T')[0];
      url = `${this.baseUrl}/historical-candle/${encodeURIComponent(instrumentKey)}/${intervalStr}/${toDate}/${fromDate}`;
    }

    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!res.ok) {
        console.warn(`[Upstox] HTTP ${res.status} on OHLC for ${cleanSymbol}, falling back to mock.`);
        return this.mockFallback.getOhlc(symbol, timeframe);
      }

      const json = await res.json();
      const rawCandles = json.data?.candles || [];

      if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
        return this.mockFallback.getOhlc(symbol, timeframe);
      }

      // Upstox returns newest candles first; sort ascending for charts
      let candles: MarketOhlcCandle[] = rawCandles
        .map((c: any[]) => {
          const d = new Date(c[0]);
          const timeLabel = isIntraday
            ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
            : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

          return {
            time: timeLabel,
            timestamp: d.getTime(),
            open: Number(c[1]),
            high: Number(c[2]),
            low: Number(c[3]),
            close: Number(c[4]),
            volume: Number(c[5] || 0),
          };
        })
        .reverse();

      // Aggregate buckets if needed (e.g. 5m, 15m, 1H)
      if (timeframe === '5m' || timeframe === '15m') {
        const bucketSize = timeframe === '5m' ? 5 : 15;
        candles = aggregateCandleBuckets(candles, bucketSize);
      } else if (timeframe === '1H') {
        candles = aggregateCandleBuckets(candles, 2);
      }

      return candles;
    } catch (err: any) {
      console.warn(`[Upstox] Error on OHLC: ${err.message}, using fallback.`);
      return this.mockFallback.getOhlc(symbol, timeframe);
    }
  }
}

function aggregateCandleBuckets(candles: MarketOhlcCandle[], bucketSize: number): MarketOhlcCandle[] {
  if (bucketSize <= 1 || candles.length === 0) return candles;
  const result: MarketOhlcCandle[] = [];
  for (let i = 0; i < candles.length; i += bucketSize) {
    const chunk = candles.slice(i, i + bucketSize);
    const open = chunk[0].open;
    const close = chunk[chunk.length - 1].close;
    const high = Math.max(...chunk.map((c) => c.high));
    const low = Math.min(...chunk.map((c) => c.low));
    const volume = chunk.reduce((sum, c) => sum + (c.volume || 0), 0);
    result.push({
      time: chunk[chunk.length - 1].time,
      timestamp: chunk[chunk.length - 1].timestamp,
      open,
      high,
      low,
      close,
      volume,
    });
  }
  return result;
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
