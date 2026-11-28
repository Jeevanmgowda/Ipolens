import { NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/db';
import { IpoService } from '@/services/ipoService';
import { clearSupabaseIpoCache } from '@/services/supabaseIpoProvider';
import { refreshActiveIpos } from '@/lib/ingestion/active-refresh';
import type { LiveMarketIpoItem } from '@/types/liveMarket';

/**
 * Live card data for active IPOs (open, opening soon, closed awaiting listing).
 * GET /api/ipos/live-updates?symbols=A,B — re-reads any stale IPO from InvestorGain first
 * (bounded and de-duplicated), then returns the fields the cards show, with their timestamps.
 */

export const dynamic = 'force-dynamic';

const CARD_FIELDS = [
  'status',
  'priceBand',
  'priceLow',
  'priceHigh',
  'lotSize',
  'minInvestment',
  'openDate',
  'closeDate',
  'allotmentDate',
  'listingDate',
  'remainingTime',
  'isClosingSoon',
  'gmp',
  'gmpPercent',
  'isAiPredictedGmp',
  'predictedListingPrice',
  'hasGmpData',
  'gmpSource',
  'gmpUpdatedAt',
  'currentSubscription',
  'retailSubscription',
  'niiSubscription',
  'qibSubscription',
  'employeeSubscription',
  'hasSubscriptionData',
  'subscriptionUpdatedAt',
  'registrar',
  'lastUpdated',
] as const satisfies ReadonlyArray<keyof LiveMarketIpoItem>;

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ success: false, error: 'Database is not configured.' }, { status: 503 });
  }
  const raw = new URL(request.url).searchParams.get('symbols') || '';
  const symbols = [...new Set(raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 60);
  if (!symbols.length) {
    return NextResponse.json({ success: false, error: 'symbols is required' }, { status: 400 });
  }
  try {
    const refresh = await refreshActiveIpos({ symbols });
    if (refresh.refreshed.length) clearSupabaseIpoCache();

    const wanted = new Set(symbols);
    const items = (await IpoService.getAllIpos()).filter((i) => wanted.has(i.symbol));
    const updates: Record<string, Partial<LiveMarketIpoItem>> = {};
    for (const i of items) {
      const u: Partial<LiveMarketIpoItem> = {};
      for (const f of CARD_FIELDS) (u as Record<string, unknown>)[f] = i[f];
      updates[i.symbol] = u;
    }
    return NextResponse.json({
      success: true,
      updates,
      refreshed: refresh.refreshed,
      source: 'InvestorGain (subscription, GMP, issue details)',
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ipos/live-updates]', (error as Error)?.message);
    return NextResponse.json({ success: false, error: 'Failed to load live IPO data.' }, { status: 500 });
  }
}
