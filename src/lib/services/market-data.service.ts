import { gunzipSync } from 'node:zlib';
import YahooFinance from 'yahoo-finance2';
import { getRedisClient } from '@/lib/redis';
import { cleanSymbol, getLiveQuotes as getYahooQuotes } from '@/lib/market/ipoMarketData';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export type ChartTimeframe = '1D' | '1W' | '1M' | '1Y';
export type MarketProviderName = 'upstox' | 'yahoo';

export interface OhlcBar {
  time: number; // Unix seconds, strictly ascending
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LiveQuoteResult {
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
  provider: MarketProviderName;
}

const INSTRUMENTS_URL = 'https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz';
const INSTRUMENTS_CACHE_KEY = 'upstox:nse:instruments:v1';
const INSTRUMENTS_TTL_SEC = 24 * 3600;

let memoryInstrumentMap: { map: Map<string, string>; expiresAt: number } | null = null;
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

async function cacheGet(key: string): Promise<string | null> {
  try {
    const val = await getRedisClient().get(key);
    if (val) return val;
  } catch {
    // Fallback to memory map
  }
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return hit.value;
}

async function cacheSet(key: string, value: string, ttlSec: number): Promise<void> {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  try {
    await getRedisClient().set(key, value, 'EX', ttlSec);
  } catch {
    // Memory fallback active
  }
}

function getUpstoxToken(): string {
  const token = process.env.UPSTOX_ANALYTICS_TOKEN || process.env.UPSTOX_ACCESS_TOKEN || '';
  if (!token || token.includes('your_') || token.includes('YOUR_') || token.length < 20) return '';
  return token.trim();
}

async function loadNseInstrumentMap(): Promise<Map<string, string>> {
  if (memoryInstrumentMap && Date.now() < memoryInstrumentMap.expiresAt) {
    return memoryInstrumentMap.map;
  }

  const cachedJson = await cacheGet(INSTRUMENTS_CACHE_KEY);
  if (cachedJson) {
    try {
      const entries = JSON.parse(cachedJson) as Array<[string, string]>;
      const map = new Map(entries);
      memoryInstrumentMap = { map, expiresAt: Date.now() + INSTRUMENTS_TTL_SEC * 1000 };
      return map;
    } catch {
      // Re-fetch
    }
  }

  const res = await fetch(INSTRUMENTS_URL, { signal: AbortSignal.timeout(12000), cache: 'no-store' });
  if (!res.ok) throw new Error(`Upstox instruments HTTP ${res.status}`);
  const gzBuffer = Buffer.from(await res.arrayBuffer());
  const raw = JSON.parse(gunzipSync(gzBuffer).toString('utf-8')) as Array<{
    trading_symbol?: string;
    instrument_key?: string;
    segment?: string;
  }>;

  const map = new Map<string, string>();
  for (const item of raw) {
    if (item.segment === 'NSE_EQ' && item.trading_symbol && item.instrument_key) {
      map.set(item.trading_symbol.toUpperCase(), item.instrument_key);
    }
  }

  memoryInstrumentMap = { map, expiresAt: Date.now() + INSTRUMENTS_TTL_SEC * 1000 };
  await cacheSet(INSTRUMENTS_CACHE_KEY, JSON.stringify([...map.entries()]), INSTRUMENTS_TTL_SEC);
  return map;
}

async function resolveInstrumentKey(symbol: string): Promise<string | null> {
  const clean = cleanSymbol(symbol);
  try {
    const map = await loadNseInstrumentMap();
    return map.get(clean) || map.get(`${clean}-SM`) || null;
  } catch {
    return null;
  }
}

function normalizeBars(raw: OhlcBar[]): OhlcBar[] {
  const byTime = new Map<number, OhlcBar>();
  for (const b of raw) {
    if (
      !Number.isFinite(b.time) ||
      !Number.isFinite(b.open) ||
      !Number.isFinite(b.high) ||
      !Number.isFinite(b.low) ||
      !Number.isFinite(b.close)
    ) {
      continue;
    }
    const t = Math.floor(b.time);
    byTime.set(t, {
      time: t,
      open: Math.round(b.open * 100) / 100,
      high: Math.round(b.high * 100) / 100,
      low: Math.round(b.low * 100) / 100,
      close: Math.round(b.close * 100) / 100,
      volume: Math.max(0, Math.round(b.volume || 0)),
    });
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

async function fetchUpstoxCandles(
  instrumentKey: string,
  timeframe: ChartTimeframe,
  token: string
): Promise<OhlcBar[] | null> {
  const today = new Date();
  const toDate = today.toISOString().slice(0, 10);
  const daysBack = timeframe === '1D' ? 5 : timeframe === '1W' ? 7 : timeframe === '1M' ? 30 : 365;
  const fromObj = new Date(today.getTime() - daysBack * 86_400_000);
  const fromDate = fromObj.toISOString().slice(0, 10);
  const interval = timeframe === '1D' ? '5minute' : timeframe === '1W' ? '30minute' : 'day';

  const url =
    timeframe === '1D'
      ? `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(instrumentKey)}/5minute`
      : `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/${interval}/${toDate}/${fromDate}`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
    cache: 'no-store',
  });

  if (res.status === 401 || res.status === 429 || !res.ok) {
    return null;
  }

  const json = (await res.json()) as { data?: { candles?: Array<[string, number, number, number, number, number]> } };
  const rows = json.data?.candles;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const bars: OhlcBar[] = rows.map((c) => ({
    time: Math.floor(new Date(c[0]).getTime() / 1000),
    open: Number(c[1]),
    high: Number(c[2]),
    low: Number(c[3]),
    close: Number(c[4]),
    volume: Number(c[5] || 0),
  }));
  return normalizeBars(bars);
}

async function fetchYahooCandles(symbol: string, timeframe: ChartTimeframe): Promise<OhlcBar[]> {
  const clean = cleanSymbol(symbol);
  const candidates = [`${clean}.NS`, `${clean}-SM.NS`, `${clean}.BO`];
  const now = new Date();
  const daysBack = timeframe === '1D' ? 5 : timeframe === '1W' ? 7 : timeframe === '1M' ? 30 : 365;
  const period1 = new Date(now.getTime() - daysBack * 86_400_000);
  const interval = timeframe === '1D' ? '15m' : timeframe === '1W' ? '60m' : '1d';

  for (const ticker of candidates) {
    try {
      const chart = await yf.chart(ticker, {
        period1,
        period2: now,
        interval,
      });
      const quotes = chart?.quotes || [];
      const bars = normalizeBars(
        quotes
          .filter((q) => q.date && typeof q.close === 'number')
          .map((q) => ({
            time: Math.floor(new Date(q.date).getTime() / 1000),
            open: q.open ?? q.close!,
            high: q.high ?? q.close!,
            low: q.low ?? q.close!,
            close: q.close!,
            volume: q.volume ?? 0,
          }))
      );
      if (bars.length > 0) return bars;
    } catch {
      // Try next exchange suffix
    }
  }
  return [];
}

export class MarketDataService {
  static async getCandles(
    symbol: string,
    timeframe: ChartTimeframe = '1M'
  ): Promise<{ candles: OhlcBar[]; provider: MarketProviderName }> {
    const clean = cleanSymbol(symbol);
    const cacheKey = `market:candles:${clean}:${timeframe}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as { candles: OhlcBar[]; provider: MarketProviderName };
      } catch {
        // Ignore
      }
    }

    const token = getUpstoxToken();
    if (token) {
      const instrumentKey = await resolveInstrumentKey(clean);
      if (instrumentKey) {
        const upstoxBars = await fetchUpstoxCandles(instrumentKey, timeframe, token).catch(() => null);
        if (upstoxBars && upstoxBars.length > 0) {
          const payload = { candles: upstoxBars, provider: 'upstox' as const };
          await cacheSet(cacheKey, JSON.stringify(payload), timeframe === '1D' ? 60 : 300);
          return payload;
        }
      }
    }

    const yahooBars = await fetchYahooCandles(clean, timeframe);
    const payload = { candles: yahooBars, provider: 'yahoo' as const };
    if (yahooBars.length > 0) {
      await cacheSet(cacheKey, JSON.stringify(payload), timeframe === '1D' ? 60 : 300);
    }
    return payload;
  }

  static async getQuotes(symbols: string[]): Promise<{
    quotes: Record<string, LiveQuoteResult>;
    provider: MarketProviderName;
  }> {
    const unique = [...new Set(symbols.map(cleanSymbol).filter(Boolean))].slice(0, 60);
    const quotes: Record<string, LiveQuoteResult> = {};
    let primaryProvider: MarketProviderName = 'yahoo';

    const uncached: string[] = [];
    for (const sym of unique) {
      const hit = await cacheGet(`quote:${sym}`);
      if (hit) {
        try {
          const parsed = JSON.parse(hit) as LiveQuoteResult;
          quotes[sym] = parsed;
          if (parsed.provider === 'upstox') primaryProvider = 'upstox';
          continue;
        } catch {
          // Ignore malformed cache entry
        }
      }
      uncached.push(sym);
    }

    if (uncached.length === 0) {
      return { quotes, provider: primaryProvider };
    }

    const token = getUpstoxToken();
    const missingForYahoo: string[] = [];

    if (token && uncached.length > 0) {
      const keyEntries: Array<{ symbol: string; key: string }> = [];
      for (const sym of uncached) {
        const key = await resolveInstrumentKey(sym);
        if (key) keyEntries.push({ symbol: sym, key });
        else missingForYahoo.push(sym);
      }

      if (keyEntries.length > 0) {
        try {
          const res = await fetch(
            `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(
              keyEntries.map((e) => e.key).join(',')
            )}`,
            {
              headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
              signal: AbortSignal.timeout(5000),
              cache: 'no-store',
            }
          );
          if (res.ok) {
            const json = (await res.json()) as { data?: Record<string, Record<string, unknown>> };
            const data = json.data || {};
            for (const { symbol, key } of keyEntries) {
              const q = data[key] || data[key.replace('|', ':')] || Object.values(data).find((v) => v?.instrument_token === key);
              if (q && typeof q.last_price === 'number') {
                const ohlc = (q.ohlc as Record<string, number> | undefined) || {};
                const ltp = Number(q.last_price);
                const prev = Number(ohlc.close || ltp);
                const change = Number((ltp - prev).toFixed(2));
                const changePercent = prev > 0 ? Number(((change / prev) * 100).toFixed(2)) : 0;
                const quote: LiveQuoteResult = {
                  symbol,
                  ltp,
                  open: Number(ohlc.open || ltp),
                  high: Number(ohlc.high || ltp),
                  low: Number(ohlc.low || ltp),
                  previousClose: prev,
                  change,
                  changePercent,
                  volume: Number(q.volume || 0),
                  timestamp: String(q.timestamp || new Date().toISOString()),
                  provider: 'upstox',
                };
                quotes[symbol] = quote;
                void cacheSet(`quote:${symbol}`, JSON.stringify(quote), 60);
                primaryProvider = 'upstox';
              } else {
                missingForYahoo.push(symbol);
              }
            }
          } else {
            missingForYahoo.push(...keyEntries.map((e) => e.symbol));
          }
        } catch {
          missingForYahoo.push(...keyEntries.map((e) => e.symbol));
        }
      }
    } else {
      missingForYahoo.push(...uncached);
    }

    if (missingForYahoo.length > 0) {
      const yahooMap = await getYahooQuotes(missingForYahoo).catch(() => ({} as Record<string, LiveQuoteResult>));
      for (const sym of missingForYahoo) {
        const fallback = yahooMap[sym];
        if (fallback) {
          const quote: LiveQuoteResult = {
            symbol: sym,
            ltp: fallback.ltp,
            open: fallback.open,
            high: fallback.high,
            low: fallback.low,
            previousClose: fallback.previousClose,
            change: fallback.change,
            changePercent: fallback.changePercent,
            volume: fallback.volume,
            timestamp: fallback.timestamp,
            provider: 'yahoo',
          };
          quotes[sym] = quote;
          void cacheSet(`quote:${sym}`, JSON.stringify(quote), 60);
        }
      }
    }

    return { quotes, provider: primaryProvider };
  }
}
