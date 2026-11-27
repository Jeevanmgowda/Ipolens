import type { MarketQuoteData, MarketOhlcCandle, MarketStatus } from '@/types/liveMarket';
import { IpoRepository } from '@/lib/repositories/ipo.repository';
import { BROWSER_UA } from '@/lib/ingestion/http';

/**
 * Secondary-market prices for listed IPOs. Source: Yahoo Finance chart API (NSE ".NS" /
 * BSE ".BO" tickers, delayed). Every response carries its source; when the provider has no data
 * the caller gets an error, never a synthetic or stale fabricated price.
 */

export class MarketDataUnavailableError extends Error {
  constructor(symbol: string, reason: string) {
    super(`No market data for ${symbol}: ${reason}`);
    this.name = 'MarketDataUnavailableError';
  }
}

export interface SourcedQuote extends MarketQuoteData {
  source: string;
  ticker: string;
}

const TIMEFRAMES: Record<string, { interval: string; range: string }> = {
  '1D': { interval: '5m', range: '1d' },
  '5D': { interval: '15m', range: '5d' },
  '1W': { interval: '30m', range: '5d' },
  '1M': { interval: '1d', range: '1mo' },
  '3M': { interval: '1d', range: '3mo' },
  '6M': { interval: '1d', range: '6mo' },
  '1Y': { interval: '1d', range: '1y' },
  ALL: { interval: '1wk', range: 'max' },
};

const quoteCache = new Map<string, { data: SourcedQuote; expiry: number }>();

/** Maps an IPOLENS symbol to a Yahoo ticker: NSE symbol -> X.NS, BSE scrip code -> 123456.BO. */
async function resolveTicker(symbol: string): Promise<string> {
  const clean = symbol.toUpperCase().replace(/\.NS$|\.BO$/, '').replace(/^NSE:|^NSE_EQ\|/, '').trim();
  const bse = /^BSE(\d+)$/.exec(clean);
  if (bse) return `${bse[1]}.BO`;
  const ipo = await IpoRepository.getBySymbol(clean).catch(() => null);
  if (ipo?.extra.bseScripCode && !ipo.exchange?.includes('NSE')) return `${ipo.extra.bseScripCode}.BO`;
  return `${clean}.NS`;
}

async function yahooChart(ticker: string, interval: string, range: string) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`,
    { headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' }, signal: AbortSignal.timeout(8000), cache: 'no-store' }
  );
  if (!res.ok) throw new MarketDataUnavailableError(ticker, `Yahoo HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new MarketDataUnavailableError(ticker, json?.chart?.error?.description || 'empty response');
  return result;
}

export class MarketService {
  static getMarketStatus(now = new Date()): MarketStatus {
    const ist = new Date(now.getTime() + 5.5 * 3600000);
    const day = ist.getUTCDay();
    const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
    return day >= 1 && day <= 5 && minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30 ? 'OPEN' : 'CLOSED';
  }

  static async getQuote(symbol: string): Promise<SourcedQuote> {
    const cached = quoteCache.get(symbol);
    if (cached && cached.expiry > Date.now()) return cached.data;

    const ticker = await resolveTicker(symbol);
    const r = await yahooChart(ticker, '1d', '5d');
    const meta = r.meta || {};
    const ltp = Number(meta.regularMarketPrice);
    if (!Number.isFinite(ltp)) throw new MarketDataUnavailableError(ticker, 'no last traded price');
    const prev = Number(meta.chartPreviousClose ?? meta.previousClose ?? ltp);
    const q = r.indicators?.quote?.[0] || {};
    const last = (arr: number[] | undefined) => (arr ? [...arr].reverse().find((v) => Number.isFinite(v)) : undefined);
    const quote: SourcedQuote = {
      symbol: symbol.toUpperCase(),
      ticker,
      ltp,
      open: Number(last(q.open) ?? ltp),
      high: Number(meta.regularMarketDayHigh ?? last(q.high) ?? ltp),
      low: Number(meta.regularMarketDayLow ?? last(q.low) ?? ltp),
      previousClose: prev,
      volume: Number(meta.regularMarketVolume ?? last(q.volume) ?? 0),
      change: Math.round((ltp - prev) * 100) / 100,
      changePercent: prev ? Math.round(((ltp - prev) / prev) * 10000) / 100 : 0,
      timestamp: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
      isMock: false,
      source: 'Yahoo Finance (delayed)',
    };
    quoteCache.set(symbol, { data: quote, expiry: Date.now() + 15000 });
    return quote;
  }

  static async getOhlc(symbol: string, timeframe = '1D'): Promise<{ candles: MarketOhlcCandle[]; source: string; ticker: string }> {
    const tf = TIMEFRAMES[timeframe.toUpperCase()] || TIMEFRAMES['1D'];
    const ticker = await resolveTicker(symbol);
    const r = await yahooChart(ticker, tf.interval, tf.range);
    const ts: number[] = r.timestamp || [];
    const q = r.indicators?.quote?.[0] || {};
    const candles: MarketOhlcCandle[] = [];
    ts.forEach((t, i) => {
      const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
      if ([o, h, l, c].every((v) => Number.isFinite(v))) {
        candles.push({
          time: new Date(t * 1000).toISOString(),
          timestamp: t * 1000,
          open: o,
          high: h,
          low: l,
          close: c,
          volume: Number(q.volume?.[i] ?? 0),
        });
      }
    });
    if (!candles.length) throw new MarketDataUnavailableError(ticker, 'no candles for this range');
    return { candles, source: 'Yahoo Finance (delayed)', ticker };
  }
}
