import { inArray } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { IpoRepository, todayIst } from '@/lib/repositories/ipo.repository';
import { fetchJson } from './http';

/**
 * Delayed secondary-market quotes for IPOs listed in the last 12 months (Yahoo Finance chart
 * API, ~15 min delayed), stored in market_quotes. Only stale quotes are refetched: hourly during
 * market hours, otherwise once after the 15:30 IST close.
 */

const SOURCE = 'Yahoo Finance';

export interface QuoteRefreshReport {
  candidates: number;
  refreshed: number;
  failed: number;
}

interface YahooChart {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketVolume?: number;
        previousClose?: number;
        regularMarketTime?: number;
      };
      indicators?: { quote?: Array<{ open?: Array<number | null>; close?: Array<number | null> }> };
    }>;
  };
}

/** NSE symbols trade as SYMBOL.NS; BSE-only issues are stored as BSE<scrip code> → CODE.BO. */
export function yahooTicker(symbol: string): string | null {
  const bse = symbol.match(/^BSE(\d{6})$/);
  if (bse) return `${bse[1]}.BO`;
  if (!/^[A-Z0-9&-]{1,20}$/.test(symbol)) return null;
  return `${symbol}.NS`;
}

/**
 * Yahoo ticker candidates in the order to try: NSE Emerge (SME) issues trade as SYMBOL-SM.NS,
 * BSE SME issues as SYMBOL.BO or <scrip code>.BO, mainboard issues as SYMBOL.NS / SYMBOL.BO.
 */
export function yahooTickers(r: { symbol: string; exchange: string | null; extra?: { bseScripCode?: number | null } }): string[] {
  const base = yahooTicker(r.symbol);
  if (!base) return [];
  if (base.endsWith('.BO') && /^\d/.test(base)) return [base];
  const sym = r.symbol;
  const ex = (r.exchange || '').toUpperCase();
  const code = r.extra?.bseScripCode ? `${r.extra.bseScripCode}.BO` : null;
  const list = ex.includes('NSE SME')
    ? [`${sym}-SM.NS`, `${sym}.NS`]
    : ex.includes('BSE SME')
      ? [code, `${sym}.BO`]
      : [`${sym}.NS`, code, `${sym}.BO`];
  return [...new Set(list.filter((t): t is string => Boolean(t)))];
}

export function parseYahooQuote(json: YahooChart) {
  const r = json.chart?.result?.[0];
  const m = r?.meta;
  if (!m || typeof m.regularMarketPrice !== 'number') return null;
  const closes = (r?.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => typeof c === 'number');
  const opens = (r?.indicators?.quote?.[0]?.open ?? []).filter((c): c is number => typeof c === 'number');
  const ltp = m.regularMarketPrice;
  const previousClose = typeof m.previousClose === 'number' ? m.previousClose : closes.length >= 2 ? closes[closes.length - 2] : null;
  if (previousClose === null) return null;
  const change = ltp - previousClose;
  return {
    ltp,
    open: opens.length ? opens[opens.length - 1] : ltp,
    high: m.regularMarketDayHigh ?? ltp,
    low: m.regularMarketDayLow ?? ltp,
    previousClose,
    volume: Math.min(2_147_483_647, Math.max(0, Math.round(m.regularMarketVolume ?? 0))),
    change,
    changePercent: previousClose > 0 ? (change / previousClose) * 100 : 0,
    timestamp: m.regularMarketTime ? new Date(m.regularMarketTime * 1000) : new Date(),
  };
}

function isStale(fetchedAt: Date | undefined, now: Date): boolean {
  if (!fetchedAt) return true;
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const weekday = ist.getUTCDay() >= 1 && ist.getUTCDay() <= 5;
  if (weekday && minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30) {
    return now.getTime() - fetchedAt.getTime() > 60 * 60_000;
  }
  // Outside market hours: one refresh after the latest close.
  const lastClose = new Date(`${todayIst(now)}T15:30:00+05:30`);
  if (now < lastClose) lastClose.setUTCDate(lastClose.getUTCDate() - 1);
  return fetchedAt < lastClose;
}

export async function refreshListedQuotes(options: { now?: Date; limit?: number } = {}): Promise<QuoteRefreshReport> {
  const now = options.now ?? new Date();
  const db = getDb();
  const yearAgo = new Date(now.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  const listed = (await IpoRepository.listAll()).filter(
    (r) => r.status === 'Listed' && (r.listingDate ?? r.openDate ?? '') >= yearAgo && yahooTickers(r).length > 0
  );
  if (!listed.length) return { candidates: 0, refreshed: 0, failed: 0 };

  const existing = await db
    .select({ symbol: schema.marketQuotesTable.symbol, fetchedAt: schema.marketQuotesTable.timestamp })
    .from(schema.marketQuotesTable)
    .where(inArray(schema.marketQuotesTable.symbol, listed.map((r) => r.symbol)));
  const fetchedAt = new Map(existing.map((e) => [e.symbol, e.fetchedAt]));
  const stale = listed.filter((r) => isStale(fetchedAt.get(r.symbol), now)).slice(0, options.limit ?? 250);

  let refreshed = 0;
  let failed = 0;
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, stale.length) }, async () => {
      while (next < stale.length) {
        const rec = stale[next++];
        try {
          let q: ReturnType<typeof parseYahooQuote> = null;
          for (const ticker of yahooTickers(rec)) {
            const json = await fetchJson<YahooChart>(
              SOURCE,
              `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`,
              { timeoutMs: 8000, retries: 1 }
            ).catch(() => null);
            q = json ? parseYahooQuote(json) : null;
            if (q) break;
          }
          if (!q) throw new Error('no quote');
          const values = {
            symbol: rec.symbol,
            ltp: q.ltp.toFixed(2),
            open: q.open.toFixed(2),
            high: q.high.toFixed(2),
            low: q.low.toFixed(2),
            previousClose: q.previousClose.toFixed(2),
            volume: q.volume,
            change: q.change.toFixed(2),
            changePercent: q.changePercent.toFixed(2),
            // Store when we fetched it, so staleness checks are about our copy.
            timestamp: now,
          };
          await db
            .insert(schema.marketQuotesTable)
            .values(values)
            .onConflictDoUpdate({ target: schema.marketQuotesTable.symbol, set: values });
          refreshed++;
        } catch {
          failed++;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    })
  );
  return { candidates: stale.length, refreshed, failed };
}
