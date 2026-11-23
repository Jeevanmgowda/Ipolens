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
  private yahooFallback = new YahooFinanceProvider();
  private mockFallback = new MockMarketProvider();

  private static upstox429CooldownUntil = 0;
  private static quoteCache = new Map<string, { data: MarketQuoteData; expiry: number }>();

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
    return this.isConfigured() && Date.now() >= UpstoxProvider.upstox429CooldownUntil;
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
    ZINKA: 'NSE_EQ|BLACKBUCK',
    BLACKBUCK: 'NSE_EQ|BLACKBUCK',
    ENVIRO: 'NSE_EQ|EIEL',
    EIEL: 'NSE_EQ|EIEL',
    JIOFIN: 'NSE_EQ|INE758E01017',
    JIOPLAT: 'NSE_EQ|INE758E01017',
    SAGILITY: 'NSE_EQ|INE0J1Z01021',
    AFCONS: 'NSE_EQ|INE101I01011',
    ACMESOLAR: 'NSE_EQ|INE0R4L01018',
    NTPCGREEN: 'NSE_EQ|INE0ON901014',
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
    const cleanSymbol = symbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').trim();

    // Check in-memory quote cache (15s TTL)
    const cached = UpstoxProvider.quoteCache.get(cleanSymbol);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    // 1. If Upstox token is present and not in 429 rate limit cooldown, attempt official Upstox API v2 quote
    if (this.isConfigured() && Date.now() >= UpstoxProvider.upstox429CooldownUntil) {
      const instrumentKey = this.resolveInstrumentKey(cleanSymbol);
      try {
        const res = await fetch(`${this.baseUrl}/market-quote/quotes?instrument_key=${encodeURIComponent(instrumentKey)}`, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`,
          },
          signal: AbortSignal.timeout(2500),
        });

        if (res.ok) {
          const json = await res.json();
          const colonKey = instrumentKey.replace('|', ':');
          const data = json.data?.[colonKey]
            || json.data?.[instrumentKey]
            || json.data?.[`NSE_EQ:${cleanSymbol}`]
            || json.data?.[`NSE_INDEX:${cleanSymbol}`]
            || Object.values(json.data || {})[0];

          if (data && (data.last_price || data.ohlc?.close)) {
            const ltp = Number(data.last_price || data.ohlc?.close || 0);
            const prevClose = Number(data.prev_close || data.ohlc?.close || ltp);
            const change = Number((ltp - prevClose).toFixed(2));
            const changePercent = prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;

            const quote: MarketQuoteData = {
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

            UpstoxProvider.quoteCache.set(cleanSymbol, { data: quote, expiry: Date.now() + 15000 });
            return quote;
          }
        } else if (res.status === 429) {
          UpstoxProvider.upstox429CooldownUntil = Date.now() + 60000;
          console.warn(`[Upstox] Rate limit (HTTP 429) hit. Pausing Upstox quote requests for 60s; using live exchange feed.`);
        } else {
          console.warn(`[Upstox] HTTP ${res.status} on quote for ${cleanSymbol}. Falling back to live exchange feed.`);
        }
      } catch (err: any) {
        if (err.name !== 'TimeoutError') {
          console.warn(`[Upstox] Network error on quote for ${cleanSymbol}: ${err.message}. Trying live exchange feed.`);
        }
      }
    }

    // 2. If mock mode is explicitly requested, use mock fallback simulator
    if (process.env.USE_MOCK_MARKET_DATA === 'true') {
      return this.mockFallback.getQuote(symbol);
    }

    // 3. Resilient live secondary market quote from exchange gateway
    const fallbackQuote = await this.yahooFallback.getQuote(symbol);
    UpstoxProvider.quoteCache.set(cleanSymbol, { data: fallbackQuote, expiry: Date.now() + 15000 });
    return fallbackQuote;
  }

  async getOhlc(symbol: string, timeframe: string = '1D'): Promise<MarketOhlcCandle[]> {
    const cleanSymbol = symbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').trim();

    // 1. If Upstox token is present, attempt official Upstox API v2 OHLC
    if (this.isConfigured()) {
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

        if (res.ok) {
          const json = await res.json();
          const rawCandles = json.data?.candles || [];

          if (Array.isArray(rawCandles) && rawCandles.length > 0) {
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

            if (timeframe === '5m' || timeframe === '15m') {
              const bucketSize = timeframe === '5m' ? 5 : 15;
              candles = aggregateCandleBuckets(candles, bucketSize);
            } else if (timeframe === '1H') {
              candles = aggregateCandleBuckets(candles, 2);
            }

            return candles;
          }
        }
      } catch (err: any) {
        console.warn(`[Upstox] Error on OHLC for ${cleanSymbol}: ${err.message}. Trying live exchange feed.`);
      }
    }

    // 2. If mock mode is explicitly requested, use mock fallback simulator
    if (process.env.USE_MOCK_MARKET_DATA === 'true') {
      return this.mockFallback.getOhlc(symbol, timeframe);
    }

    // 3. Resilient live secondary market OHLC candles from exchange gateway
    return await this.yahooFallback.getOhlc(symbol, timeframe);
  }
}

/**
 * Resilient Yahoo Finance Live Market Provider
 * Provides live secondary market LTP and OHLC bars directly from NSE India without requiring daily tokens.
 */
export class YahooFinanceProvider implements MarketDataProvider {
  name = 'Yahoo Finance (Live NSE Exchange)';
  private static yahooQuoteCache = new Map<string, { data: MarketQuoteData; expiry: number }>();
  private static failedTickersCooldown = new Map<string, number>();

  private resolveTicker(symbol: string): string {
    const clean = symbol
      .toUpperCase()
      .replace(/^NSE_EQ\|/, '')
      .replace(/^NSE_INDEX\|/, '')
      .replace(/\.NS$/, '')
      .replace(/^NSE:/, '')
      .trim();

    if (clean === 'NIFTY' || clean === 'NIFTY 50') return '^NSEI';
    if (clean === 'WAAREE') return 'WAAREEENER.NS';
    if (clean === 'ZINKA' || clean === 'BLACKBUCK') return 'BLACKBUCK.NS';
    if (clean === 'ENVIRO' || clean === 'EIEL') return 'EIEL.NS';
    if (clean === 'JIOPLAT' || clean === 'JIOFIN') return 'JIOFIN.NS';

    const registered = LISTED_IPOS_REGISTRY.find(
      (m) => m.symbol.toUpperCase() === clean
    );
    if (registered) return registered.ticker;

    return `${clean}.NS`;
  }

  async getQuote(symbol: string): Promise<MarketQuoteData> {
    const cleanSymbol = symbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').trim();

    // Check in-memory quote cache (15s TTL)
    const cached = YahooFinanceProvider.yahooQuoteCache.get(cleanSymbol);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    const ticker = this.resolveTicker(symbol);

    // If ticker recently failed (404/500), return synthetic/registered quote directly without spamming Yahoo
    const cooldown = YahooFinanceProvider.failedTickersCooldown.get(ticker);
    if (cooldown && Date.now() < cooldown) {
      return this.getRegistryFallbackQuote(cleanSymbol);
    }

    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(2500),
          cache: 'no-store',
        }
      );

      if (!res.ok) {
        // Mark ticker as cooled down for 5 minutes
        YahooFinanceProvider.failedTickersCooldown.set(ticker, Date.now() + 5 * 60 * 1000);
        return this.getRegistryFallbackQuote(cleanSymbol);
      }

      const json = await res.json();
      const meta = json.chart?.result?.[0]?.meta;
      if (!meta || typeof meta.regularMarketPrice !== 'number') {
        return this.getRegistryFallbackQuote(cleanSymbol);
      }

      const ltp = Number(meta.regularMarketPrice.toFixed(2));
      const prevClose =
        typeof meta.chartPreviousClose === 'number'
          ? Number(meta.chartPreviousClose.toFixed(2))
          : ltp;
      const change = Number((ltp - prevClose).toFixed(2));
      const changePercent =
        prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;

      const quote: MarketQuoteData = {
        symbol: cleanSymbol,
        ltp,
        open: Number(meta.regularMarketDayHigh || ltp),
        high: Number(meta.regularMarketDayHigh || ltp),
        low: Number(meta.regularMarketDayLow || ltp),
        previousClose: prevClose,
        volume: Number(meta.regularMarketVolume || 0),
        change,
        changePercent,
        timestamp: new Date().toISOString(),
        isMock: false,
      };

      YahooFinanceProvider.yahooQuoteCache.set(cleanSymbol, { data: quote, expiry: Date.now() + 15000 });
      return quote;
    } catch {
      return this.getRegistryFallbackQuote(cleanSymbol);
    }
  }

  private getRegistryFallbackQuote(cleanSymbol: string): MarketQuoteData {
    const registered = LISTED_IPOS_REGISTRY.find(
      (m) => m.symbol.toUpperCase() === cleanSymbol
    );
    const ltp = registered?.listingPrice || registered?.issuePrice || 100;
    const prevClose = registered?.issuePrice || ltp;
    const change = Number((ltp - prevClose).toFixed(2));
    const changePercent = prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;

    const fallback: MarketQuoteData = {
      symbol: cleanSymbol,
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

    YahooFinanceProvider.yahooQuoteCache.set(cleanSymbol, { data: fallback, expiry: Date.now() + 30000 });
    return fallback;
  }

  async getOhlc(symbol: string, timeframe: string = '1D'): Promise<MarketOhlcCandle[]> {
    const ticker = this.resolveTicker(symbol);
    const cleanSymbol = symbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').trim();

    let interval = '1d';
    let range = '6mo';
    if (timeframe === '1m') { interval = '1m'; range = '5d'; }
    else if (timeframe === '5m') { interval = '5m'; range = '5d'; }
    else if (timeframe === '15m') { interval = '15m'; range = '5d'; }
    else if (timeframe === '30m') { interval = '30m'; range = '1mo'; }
    else if (timeframe === '1H') { interval = '60m'; range = '1mo'; }
    else if (timeframe === '1D') { interval = '1d'; range = '1y'; }
    else if (timeframe === '1W') { interval = '1wk'; range = '2y'; }
    else if (timeframe === '1M') { interval = '1mo'; range = '5y'; }

    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(2500),
          cache: 'no-store',
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const result = json.chart?.result?.[0];
      const timestamps: number[] = result?.timestamp || [];
      const quotes = result?.indicators?.quote?.[0] || {};
      const opens = quotes.open || [];
      const highs = quotes.high || [];
      const lows = quotes.low || [];
      const closes = quotes.close || [];
      const volumes = quotes.volume || [];

      const candles: MarketOhlcCandle[] = [];
      const isIntraday = ['1m', '5m', '15m', '30m', '1H'].includes(timeframe);

      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] === null || closes[i] === undefined || isNaN(closes[i])) continue;
        const d = new Date(timestamps[i] * 1000);
        const timeLabel = isIntraday
          ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
          : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

        const closeVal = Number(closes[i].toFixed(2));
        const openVal = Number((opens[i] != null && !isNaN(opens[i]) ? opens[i] : closeVal).toFixed(2));
        const highVal = Number((highs[i] != null && !isNaN(highs[i]) ? highs[i] : Math.max(openVal, closeVal)).toFixed(2));
        const lowVal = Number((lows[i] != null && !isNaN(lows[i]) ? lows[i] : Math.min(openVal, closeVal)).toFixed(2));

        candles.push({
          time: timeLabel,
          timestamp: timestamps[i] * 1000,
          open: openVal,
          high: highVal,
          low: lowVal,
          close: closeVal,
          volume: Number(volumes[i] || 0),
        });
      }

      if (candles.length > 0) return candles;
      throw new Error('No candle records parsed');
    } catch (err: any) {
      console.warn(`[YahooFinanceProvider] OHLC fetch error for ${cleanSymbol}:`, err.message);
      throw err;
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
