import { isDatabaseConfigured, getDb, schema } from '@/db';
import { IpoRepository, type IpoRecord } from '@/lib/repositories/ipo.repository';
import { fetchJson } from '@/lib/ingestion/http';
import { yahooTickers } from '@/lib/ingestion/quotes';
import type { MarketOhlcCandle, MarketQuoteData } from '@/types/liveMarket';

/**
 * Real secondary-market data for any IPO stored in Supabase (and the main indices), from the
 * Yahoo Finance chart API (NSE/BSE, delayed up to ~15 min). The right ticker is derived from the
 * IPO's exchange: NSE Emerge issues trade as SYMBOL-SM.NS, BSE issues as CODE.BO / SYMBOL.BO.
 *
 * Nothing here invents a price: when no exchange data exists the functions return null / [].
 */

const SOURCE = 'Yahoo Finance';
const INDEX_TICKERS: Record<string, string> = {
  NIFTY: '^NSEI',
  'NIFTY 50': '^NSEI',
  NIFTY50: '^NSEI',
  SENSEX: '^BSESN',
  BANKNIFTY: '^NSEBANK',
};

interface YahooChartResult {
  meta?: {
    regularMarketPrice?: number;
    regularMarketDayHigh?: number;
    regularMarketDayLow?: number;
    regularMarketVolume?: number;
    regularMarketTime?: number;
    previousClose?: number;
    chartPreviousClose?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    currency?: string;
    shortName?: string;
    longName?: string;
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: Array<number | null>;
      high?: Array<number | null>;
      low?: Array<number | null>;
      close?: Array<number | null>;
      volume?: Array<number | null>;
    }>;
  };
}

export interface ChartFetch {
  ticker: string;
  result: YahooChartResult;
}

const tickerCache = new Map<string, { tickers: string[]; record: IpoRecord | null; expiry: number }>();
const chartCache = new Map<string, { data: ChartFetch | null; expiry: number }>();
const workingTicker = new Map<string, string>();

export function cleanSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/\.(NS|BO)$/, '').replace(/^(NSE|BSE):/, '').trim();
}

async function resolve(symbol: string): Promise<{ tickers: string[]; record: IpoRecord | null }> {
  const sym = cleanSymbol(symbol);
  if (INDEX_TICKERS[sym]) return { tickers: [INDEX_TICKERS[sym]], record: null };
  const hit = tickerCache.get(sym);
  if (hit && Date.now() < hit.expiry) return hit;

  let record: IpoRecord | null = null;
  if (isDatabaseConfigured()) {
    record = await IpoRepository.getBySymbol(sym).catch(() => null);
  }
  const fromRecord = record ? yahooTickers(record) : [];
  const generic = /^[A-Z0-9&-]{1,20}$/.test(sym) ? [`${sym}.NS`, `${sym}.BO`] : [];
  const tickers = [...new Set([...(workingTicker.has(sym) ? [workingTicker.get(sym)!] : []), ...fromRecord, ...generic])];
  const value = { tickers, record, expiry: Date.now() + 30 * 60_000 };
  tickerCache.set(sym, value);
  return value;
}

/** Fetches a Yahoo chart for the first ticker candidate that has data. Cached per range. */
export async function fetchChart(symbol: string, interval: string, range: string, ttlMs = 30_000): Promise<ChartFetch | null> {
  const sym = cleanSymbol(symbol);
  const key = `${sym}|${interval}|${range}`;
  const cached = chartCache.get(key);
  if (cached && Date.now() < cached.expiry) return cached.data;

  const { tickers } = await resolve(sym);
  let found: ChartFetch | null = null;
  for (const ticker of tickers) {
    const json = await fetchJson<{ chart?: { result?: YahooChartResult[] } }>(
      SOURCE,
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`,
      { timeoutMs: 6000, retries: 0 }
    ).catch(() => null);
    const result = json?.chart?.result?.[0];
    if (result?.meta && typeof result.meta.regularMarketPrice === 'number') {
      found = { ticker, result };
      workingTicker.set(sym, ticker);
      break;
    }
  }
  // Remember misses for longer so unknown symbols do not hammer the upstream.
  chartCache.set(key, { data: found, expiry: Date.now() + (found ? ttlMs : 5 * 60_000) });
  return found;
}

const round = (n: number) => Math.round(n * 100) / 100;

function series(result: YahooChartResult) {
  const q = result.indicators?.quote?.[0] ?? {};
  const ts = result.timestamp ?? [];
  const rows: Array<{ t: number; open: number; high: number; low: number; close: number; volume: number }> = [];
  ts.forEach((t, i) => {
    const close = q.close?.[i];
    if (typeof close !== 'number' || !Number.isFinite(close)) return;
    const open = q.open?.[i] ?? close;
    rows.push({
      t,
      open: typeof open === 'number' ? open : close,
      high: typeof q.high?.[i] === 'number' ? (q.high[i] as number) : close,
      low: typeof q.low?.[i] === 'number' ? (q.low[i] as number) : close,
      close,
      volume: typeof q.volume?.[i] === 'number' ? (q.volume[i] as number) : 0,
    });
  });
  return rows;
}

/** Latest quote; previous close is the prior daily close (not the start of the chart range). */
export async function getLiveQuote(symbol: string): Promise<(MarketQuoteData & { ticker: string; source: string }) | null> {
  const sym = cleanSymbol(symbol);
  const chart = await fetchChart(sym, '1d', '5d', 30_000);
  if (!chart) return null;
  const m = chart.result.meta!;
  const days = series(chart.result);
  const ltp = m.regularMarketPrice!;
  const prev =
    typeof m.previousClose === 'number'
      ? m.previousClose
      : days.length >= 2
        ? days[days.length - 2].close
        : typeof m.chartPreviousClose === 'number'
          ? m.chartPreviousClose
          : null;
  if (prev === null) return null;
  const today = days[days.length - 1];
  const change = ltp - prev;
  const quote = {
    symbol: sym,
    ltp: round(ltp),
    open: round(today?.open ?? ltp),
    high: round(m.regularMarketDayHigh ?? today?.high ?? ltp),
    low: round(m.regularMarketDayLow ?? today?.low ?? ltp),
    previousClose: round(prev),
    volume: Math.max(0, Math.round(m.regularMarketVolume ?? today?.volume ?? 0)),
    change: round(change),
    changePercent: prev > 0 ? round((change / prev) * 100) : 0,
    timestamp: new Date((m.regularMarketTime ?? Date.now() / 1000) * 1000).toISOString(),
    isMock: false,
    ticker: chart.ticker,
    source: SOURCE,
  };
  void persistQuote(quote);
  return quote;
}

async function persistQuote(q: MarketQuoteData): Promise<void> {
  if (!isDatabaseConfigured() || q.symbol.startsWith('^')) return;
  try {
    const values = {
      symbol: q.symbol,
      ltp: q.ltp.toFixed(2),
      open: q.open.toFixed(2),
      high: q.high.toFixed(2),
      low: q.low.toFixed(2),
      previousClose: q.previousClose.toFixed(2),
      volume: Math.min(2_147_483_647, q.volume),
      change: q.change.toFixed(2),
      changePercent: q.changePercent.toFixed(2),
      timestamp: new Date(),
    };
    await getDb()
      .insert(schema.marketQuotesTable)
      .values(values)
      .onConflictDoUpdate({ target: schema.marketQuotesTable.symbol, set: values });
  } catch {
    // Best effort: the live value has already been returned to the caller.
  }
}

/** Many quotes at once (bounded concurrency), for refreshing cards. */
export async function getLiveQuotes(symbols: string[]): Promise<Record<string, MarketQuoteData & { ticker: string; source: string }>> {
  const unique = [...new Set(symbols.map(cleanSymbol))].slice(0, 60);
  const out: Record<string, MarketQuoteData & { ticker: string; source: string }> = {};
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(6, unique.length) }, async () => {
      while (next < unique.length) {
        const s = unique[next++];
        const q = await getLiveQuote(s).catch(() => null);
        if (q) out[s] = q;
      }
    })
  );
  return out;
}

const TIMEFRAMES: Record<string, { interval: string; range: string }> = {
  '1m': { interval: '1m', range: '1d' },
  '5m': { interval: '5m', range: '5d' },
  '15m': { interval: '15m', range: '5d' },
  '30m': { interval: '30m', range: '1mo' },
  '1H': { interval: '60m', range: '1mo' },
  '1D': { interval: '1d', range: '1y' },
  '1W': { interval: '1wk', range: '2y' },
  '1M': { interval: '1mo', range: '5y' },
};

export async function getCandles(symbol: string, timeframe = '1D'): Promise<MarketOhlcCandle[]> {
  const tf = TIMEFRAMES[timeframe] ?? TIMEFRAMES['1D'];
  const chart = await fetchChart(symbol, tf.interval, tf.range, tf.interval.endsWith('m') ? 30_000 : 5 * 60_000);
  if (!chart) return [];
  const intraday = /m$/.test(tf.interval);
  return series(chart.result).map((r) => {
    const d = new Date(r.t * 1000);
    return {
      time: intraday
        ? d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: '2-digit' }),
      timestamp: r.t * 1000,
      open: round(r.open),
      high: round(r.high),
      low: round(r.low),
      close: round(r.close),
      volume: r.volume,
    };
  });
}

export interface IpoChartPoint {
  timestamp: number;
  date: string;
  time: string;
  price: number;
  volume: number;
}

export interface IpoChartData {
  symbol: string;
  companyName: string;
  ticker: string;
  source: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  previousClose: number;
  currency: string;
  range: string;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  issuePrice?: number;
  listingPrice?: number;
  listingDate?: string;
  gainVsIssuePct?: number;
  points: IpoChartPoint[];
}

const RANGE_INTERVAL: Record<string, string> = {
  '1d': '5m',
  '5d': '15m',
  '1mo': '1d',
  '3mo': '1d',
  '6mo': '1d',
  '1y': '1d',
  max: '1wk',
};

/** Price chart since listing for one IPO, with its issue and listing price from Supabase. */
export async function getIpoChart(symbol: string, rangeInput = '1mo'): Promise<IpoChartData | null> {
  const range = RANGE_INTERVAL[rangeInput.toLowerCase()] ? rangeInput.toLowerCase() : '1mo';
  const sym = cleanSymbol(symbol);
  const [chart, quote, { record }] = await Promise.all([
    fetchChart(sym, RANGE_INTERVAL[range], range, range === '1d' || range === '5d' ? 30_000 : 5 * 60_000),
    getLiveQuote(sym),
    resolve(sym),
  ]);
  if (!chart || !quote) return null;
  const m = chart.result.meta!;
  const intraday = range === '1d' || range === '5d';
  // A newly listed stock has no history before its listing day; drop anything earlier.
  const listedFrom = record?.listingDate ? new Date(`${record.listingDate}T00:00:00+05:30`).getTime() / 1000 : 0;
  const points = series(chart.result)
    .filter((r) => r.t >= listedFrom)
    .map((r) => {
      const d = new Date(r.t * 1000);
      return {
        timestamp: r.t,
        date: intraday
          ? d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
          : d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' }),
        time: d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }),
        price: round(r.close),
        volume: r.volume,
      };
    });
  const issuePrice = record?.issuePrice ?? record?.priceHigh ?? undefined;
  return {
    symbol: sym,
    companyName: record?.companyName || m.longName || m.shortName || sym,
    ticker: chart.ticker,
    source: SOURCE,
    currentPrice: quote.ltp,
    change: quote.change,
    changePercent: quote.changePercent,
    previousClose: quote.previousClose,
    currency: m.currency || 'INR',
    range,
    dayHigh: quote.high,
    dayLow: quote.low,
    fiftyTwoWeekHigh: typeof m.fiftyTwoWeekHigh === 'number' ? round(m.fiftyTwoWeekHigh) : null,
    fiftyTwoWeekLow: typeof m.fiftyTwoWeekLow === 'number' ? round(m.fiftyTwoWeekLow) : null,
    issuePrice: issuePrice ?? undefined,
    listingPrice: record?.listingPrice ?? undefined,
    listingDate: record?.listingDate ?? undefined,
    gainVsIssuePct: issuePrice ? round(((quote.ltp - issuePrice) / issuePrice) * 100) : undefined,
    points,
  };
}

/** Test seam. */
export function clearMarketDataCaches(): void {
  tickerCache.clear();
  chartCache.clear();
  workingTicker.clear();
}
