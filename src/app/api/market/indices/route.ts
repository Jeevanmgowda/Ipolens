import { NextResponse } from 'next/server';
import { BROWSER_UA } from '@/lib/ingestion/http';

export const dynamic = 'force-dynamic';

const INDICES = [
  { name: 'NIFTY 50', ticker: '^NSEI' },
  { name: 'SENSEX', ticker: '^BSESN' },
];

let cache: { at: number; data: unknown } | null = null;

/** Delayed index levels from Yahoo Finance; indices that fail are omitted rather than invented. */
export async function GET() {
  if (cache && Date.now() - cache.at < 60_000) return NextResponse.json(cache.data);
  const results = await Promise.allSettled(
    INDICES.map(async (i) => {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(i.ticker)}?interval=1d&range=5d`, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(6000),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const meta = (await res.json())?.chart?.result?.[0]?.meta;
      const last = Number(meta?.regularMarketPrice);
      const prev = Number(meta?.chartPreviousClose ?? meta?.previousClose);
      if (!Number.isFinite(last) || !Number.isFinite(prev) || !prev) throw new Error('no data');
      return { name: i.name, last, changePercent: Math.round(((last - prev) / prev) * 10000) / 100 };
    })
  );
  const data = {
    success: true,
    source: 'Yahoo Finance (delayed)',
    indices: results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])),
  };
  cache = { at: Date.now(), data };
  return NextResponse.json(data);
}
