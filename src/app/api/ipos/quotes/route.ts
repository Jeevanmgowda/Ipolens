import { NextResponse } from 'next/server';
import { getDb, isDatabaseConfigured, schema } from '@/db';
import { IpoService } from '@/services/ipoService';
import { clearSupabaseIpoCache } from '@/services/supabaseIpoProvider';
import { cleanSymbol } from '@/lib/market/ipoMarketData';
import { MarketDataService } from '@/lib/services/market-data.service';

/**
 * Live (delayed up to ~15 min) prices for listed IPOs, used to refresh the cards in place.
 * GET /api/ipos/quotes?symbols=A,B,C — at most 60 symbols, and only IPOs that are listed in
 * Supabase, so this cannot be used as an open proxy to the quote source.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ success: false, error: 'Database is not configured.' }, { status: 503 });
  }
  const raw = new URL(request.url).searchParams.get('symbols') || '';
  const requested = [...new Set(raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 60);
  if (!requested.length) {
    return NextResponse.json({ success: false, error: 'symbols is required' }, { status: 400 });
  }
  try {
    const listed = new Set((await IpoService.getListedIpos()).map((i) => i.symbol));
    const allowed = requested.filter((s) => listed.has(s));
    const { quotes: rawQuotes, provider } = await MarketDataService.getQuotes(allowed);
    const quotes: Record<string, (typeof rawQuotes)[string]> = {};
    for (const sym of allowed) {
      const q = rawQuotes[sym] || rawQuotes[cleanSymbol(sym)];
      if (q) quotes[sym] = { ...q, symbol: sym };
    }

    const entries = Object.values(quotes);
    if (entries.length > 0) {
      const db = getDb();
      await Promise.all(
        entries.map((q) => {
          const values = {
            symbol: q.symbol,
            ltp: q.ltp.toFixed(2),
            open: q.open.toFixed(2),
            high: q.high.toFixed(2),
            low: q.low.toFixed(2),
            previousClose: q.previousClose.toFixed(2),
            volume: Math.min(2_147_483_647, Math.max(0, Math.round(q.volume))),
            change: q.change.toFixed(2),
            changePercent: q.changePercent.toFixed(2),
            timestamp: new Date(q.timestamp),
          };
          return db
            .insert(schema.marketQuotesTable)
            .values(values)
            .onConflictDoUpdate({ target: schema.marketQuotesTable.symbol, set: values })
            .catch(() => null);
        })
      );
      clearSupabaseIpoCache();
    }

    return NextResponse.json({
      success: true,
      count: Object.keys(quotes).length,
      quotes,
      provider,
      source: provider === 'upstox' ? 'Upstox API v2 (NSE/BSE)' : 'NSE/BSE via Yahoo Finance (delayed up to 15 min)',
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ipos/quotes]', (error as Error)?.message);
    return NextResponse.json({ success: false, error: 'Failed to fetch live quotes.' }, { status: 500 });
  }
}
