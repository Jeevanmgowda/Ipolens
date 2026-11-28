import { NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/db';
import { IpoService } from '@/services/ipoService';
import { getLiveQuotes } from '@/lib/market/ipoMarketData';

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
    const quotes = await getLiveQuotes(allowed);
    return NextResponse.json({
      success: true,
      count: Object.keys(quotes).length,
      quotes,
      source: 'NSE/BSE via Yahoo Finance (delayed up to 15 min)',
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ipos/quotes]', (error as Error)?.message);
    return NextResponse.json({ success: false, error: 'Failed to fetch live quotes.' }, { status: 500 });
  }
}
