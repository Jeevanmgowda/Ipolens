import { inArray } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { IpoRepository, type IpoDbView } from '@/lib/repositories/ipo.repository';
import type { LiveMarketIpoItem } from '@/types/liveMarket';
import type { LiveIpoDetail, LiveIpoSummary } from '@/types/ipo';
import type { IPODataProvider } from './ipoDataProvider';
import { predictGmpForIpo } from './mlListingGainModel';

/**
 * Reads every IPO from Supabase (written by the sync in src/lib/ingestion) and maps it to the
 * shapes the existing UI expects. Values that are not known stay unknown: numeric fields the
 * UI types as `number` are 0 with a `has…Data` flag set to false, and the UI shows "—".
 *
 * The AI listing-gain estimate is only used when there is no market GMP for an Upcoming/Open
 * issue, and is always flagged `isAiPredictedGmp` so it is never presented as market GMP.
 */

const CACHE_TTL_MS = 15_000;
let cache: { at: number; items: LiveMarketIpoItem[] } | null = null;

export function clearSupabaseIpoCache(): void {
  cache = null;
}

const dateOr = (d: string | null | undefined, fallback = 'TBD') => d || fallback;

function istToday(now = new Date()): string {
  return new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

export function remainingTimeFor(v: Pick<IpoDbView, 'status' | 'openDate' | 'closeDate'>, now = new Date()): {
  remainingTime: string;
  isClosingSoon: boolean;
} {
  const today = istToday(now);
  if (v.status === 'Listed') return { remainingTime: 'Listed', isClosingSoon: false };
  if (v.status === 'Closed') return { remainingTime: 'Bidding Closed', isClosingSoon: false };
  if (v.status === 'Open' && v.closeDate) {
    const d = daysBetween(today, v.closeDate);
    if (d <= 0) return { remainingTime: 'Closes today', isClosingSoon: true };
    return { remainingTime: `Closes in ${d} day${d === 1 ? '' : 's'}`, isClosingSoon: d <= 1 };
  }
  if (v.status === 'Upcoming' && v.openDate) {
    const d = daysBetween(today, v.openDate);
    if (d > 0) return { remainingTime: `Opens in ${d} day${d === 1 ? '' : 's'}`, isClosingSoon: false };
  }
  return { remainingTime: v.status === 'Upcoming' ? 'Dates to be announced' : 'Open', isClosingSoon: false };
}

interface Quote {
  ltp: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
}

async function loadQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  if (!symbols.length) return new Map();
  const rows = await getDb()
    .select()
    .from(schema.marketQuotesTable)
    .where(inArray(schema.marketQuotesTable.symbol, symbols));
  return new Map(
    rows.map((r) => [
      r.symbol,
      {
        ltp: Number(r.ltp),
        previousClose: Number(r.previousClose),
        change: Number(r.change),
        changePercent: Number(r.changePercent),
        volume: r.volume,
        timestamp: r.timestamp.toISOString(),
      },
    ])
  );
}

export function viewToLiveItem(v: IpoDbView, quote?: Quote, now = new Date()): LiveMarketIpoItem {
  const { remainingTime, isClosingSoon } = remainingTimeFor(v, now);
  const hasGmpData = v.gmp !== null;
  const hasSubscriptionData = v.currentSubscription !== null;

  let gmp = v.gmp ?? 0;
  let gmpPercent = v.gmpPercent ?? (v.gmp !== null && v.priceHigh ? Math.round((v.gmp / v.priceHigh) * 10000) / 100 : 0);
  let isAiPredictedGmp = false;
  let predictedListingPrice: number | undefined;

  if (!hasGmpData && (v.status === 'Upcoming' || v.status === 'Open') && v.priceHigh) {
    const ai = predictGmpForIpo({
      symbol: v.symbol,
      companyName: v.companyName,
      price: v.priceHigh,
      series: v.series,
      issueSizeCr: v.issueSizeCr ?? undefined,
      currentSubscription: v.currentSubscription ?? undefined,
      qibSubscription: v.qibSubscription ?? undefined,
      retailSubscription: v.retailSubscription ?? undefined,
      niiSubscription: v.niiSubscription ?? undefined,
      status: v.status,
    });
    if (ai.isAiPredicted) {
      gmp = ai.predictedGmp;
      gmpPercent = ai.predictedGainPct;
      isAiPredictedGmp = true;
      predictedListingPrice = ai.predictedListingPrice;
    }
  } else if (hasGmpData && v.priceHigh) {
    predictedListingPrice = v.priceHigh + gmp;
  }

  const isListed = v.status === 'Listed';
  return {
    id: v.id,
    symbol: v.symbol,
    companyName: v.companyName,
    status: v.status,
    series: v.series,
    priceBand: v.priceBand,
    priceRange: v.priceBand,
    priceLow: v.priceLow ?? 0,
    priceHigh: v.priceHigh ?? 0,
    lotSize: v.lotSize ?? 0,
    minInvestment: v.minInvestment ?? undefined,
    issueSize: v.issueSize,
    issueSizeCr: v.issueSizeCr ?? undefined,
    openDate: dateOr(v.openDate),
    closeDate: dateOr(v.closeDate),
    allotmentDate: dateOr(v.allotmentDate),
    listingDate: dateOr(v.listingDate),
    expectedListingDate: v.listingDate ?? undefined,
    registrar: v.registrar || '—',
    registrarUrl: v.registrarUrl,
    lastUpdated: v.lastUpdated ?? undefined,

    gmp,
    gmpPercent,
    isAiPredictedGmp,
    predictedListingPrice,

    currentSubscription: v.currentSubscription ?? 0,
    retailSubscription: v.retailSubscription ?? 0,
    niiSubscription: v.niiSubscription ?? 0,
    qibSubscription: v.qibSubscription ?? 0,
    employeeSubscription: v.employeeSubscription ?? undefined,
    remainingTime,
    isClosingSoon,

    isListed,
    issuePrice: v.issuePrice ?? undefined,
    listingPrice: v.listingPrice ?? undefined,
    currentPrice: isListed && quote ? quote.ltp : undefined,
    previousClose: isListed && quote ? quote.previousClose : undefined,
    dayChange: isListed && quote ? quote.change : undefined,
    dayChangePercent: isListed && quote ? quote.changePercent : undefined,
    volume: isListed && quote ? quote.volume : undefined,

    hasGmpData,
    hasSubscriptionData,
    gmpSource: v.gmpSource ?? undefined,
    gmpUpdatedAt: v.gmpUpdatedAt ?? undefined,
    subscriptionUpdatedAt: v.subscriptionUpdatedAt ?? undefined,
    quoteUpdatedAt: isListed && quote ? quote.timestamp : undefined,
    dataSource: v.source ?? undefined,
    registrarSlug: v.registrarSlug ?? undefined,
    rhpUrl: v.rhpUrl ?? undefined,
    drhpUrl: v.drhpUrl ?? undefined,
    freshIssueCr: v.freshIssueCr ?? undefined,
    ofsCr: v.ofsCr ?? undefined,
    ofsPercent: v.ofsPercent ?? undefined,
    sector: v.sector ?? undefined,
    peRatio: v.peRatio ?? undefined,
    listingGainPct: v.listingGainPct ?? undefined,
  };
}

/** Lifecycle order used for "all" lists: live issues first, then upcoming, closed, listed. */
const ORDER: Record<LiveMarketIpoItem['status'], number> = { Open: 0, Upcoming: 1, Closed: 2, Listed: 3 };

export class SupabaseIpoProvider implements IPODataProvider {
  name = 'Supabase (InvestorGain + BSE sync)';

  async getAllIpos(): Promise<LiveMarketIpoItem[]> {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.items;
    // DRHP filings without an issue calendar stay in Supabase (for the DRHP analyst) but are not
    // IPOs anyone can bid on yet, so they are left out of the market lists.
    const views = (await IpoRepository.listView()).filter((v) => v.status !== 'Upcoming' || Boolean(v.openDate));
    const quotes = await loadQuotes(views.filter((v) => v.status === 'Listed').map((v) => v.symbol));
    const now = new Date();
    const items = views
      .map((v) => viewToLiveItem(v, quotes.get(v.symbol), now))
      .sort((a, b) => {
        const s = ORDER[a.status] - ORDER[b.status];
        if (s !== 0) return s;
        // Upcoming: soonest first; everything else: most recent first.
        const ad = a.status === 'Listed' ? a.listingDate : a.openDate;
        const bd = b.status === 'Listed' ? b.listingDate : b.openDate;
        return a.status === 'Upcoming' ? ad.localeCompare(bd) : bd.localeCompare(ad);
      });
    cache = { at: Date.now(), items };
    return items;
  }

  async getUpcomingIpos() {
    return (await this.getAllIpos()).filter((i) => i.status === 'Upcoming');
  }
  async getOpenIpos() {
    return (await this.getAllIpos()).filter((i) => i.status === 'Open');
  }
  async getClosedIpos() {
    return (await this.getAllIpos()).filter((i) => i.status === 'Closed');
  }
  async getListedIpos() {
    return (await this.getAllIpos()).filter((i) => i.status === 'Listed');
  }
  async getIpoDetails(idOrSymbol: string) {
    const clean = idOrSymbol.toUpperCase().trim();
    const all = await this.getAllIpos();
    return all.find((i) => i.symbol === clean || i.id === idOrSymbol) || null;
  }
}

// ---------------------------------------------------------------------------
// Legacy NSE-shaped payloads (/api/ipos/live and /api/ipos/[symbol])
// ---------------------------------------------------------------------------

const legacyStatus = (s: LiveMarketIpoItem['status']): LiveIpoSummary['status'] =>
  s === 'Open' ? 'Active' : s === 'Upcoming' ? 'Forthcoming' : s;

export function toLiveIpoSummary(i: LiveMarketIpoItem): LiveIpoSummary {
  return {
    symbol: i.symbol,
    companyName: i.companyName,
    series: i.series,
    status: legacyStatus(i.status),
    issueStartDate: i.openDate,
    issueEndDate: i.closeDate,
    issuePrice: i.priceBand,
    priceBand: i.priceBand,
    priceLow: i.priceLow || undefined,
    priceHigh: i.priceHigh || undefined,
    lotSize: i.lotSize || undefined,
    minInvestment: i.minInvestment,
    issueSize: i.issueSize,
    issueSizeCr: i.issueSizeCr,
    noOfTime: i.hasSubscriptionData ? i.currentSubscription.toFixed(2) : undefined,
    gmpEstimate: i.hasGmpData || i.isAiPredictedGmp ? i.gmp : undefined,
    gmpPercent: i.hasGmpData || i.isAiPredictedGmp ? i.gmpPercent : undefined,
    retailSubscription: i.hasSubscriptionData ? i.retailSubscription : undefined,
    niiSubscription: i.hasSubscriptionData ? i.niiSubscription : undefined,
    qibSubscription: i.hasSubscriptionData ? i.qibSubscription : undefined,
    employeeSubscription: i.employeeSubscription,
    remainingTime: i.remainingTime,
    registrarName: i.registrar,
    registrarUrl: i.registrarUrl,
    isListed: i.isListed,
    listingPrice: i.listingPrice !== undefined ? String(i.listingPrice) : undefined,
    previousClose: i.previousClose,
    listingDate: i.listingDate,
    expectedListingDate: i.expectedListingDate,
  };
}

const KNOWN_SLUGS = new Set(['linkintime', 'kfintech', 'bigshare', 'cameo', 'maashitla']);

export function toLiveIpoDetail(i: LiveMarketIpoItem): LiveIpoDetail {
  const bidDetails = i.hasSubscriptionData
    ? [
        { category: 'Qualified Institutional (QIB)', noOfSharesOffered: '—', noOfTime: i.qibSubscription.toFixed(2), noOfsharesBid: '—' },
        { category: 'Non-Institutional Investors (NII)', noOfSharesOffered: '—', noOfTime: i.niiSubscription.toFixed(2), noOfsharesBid: '—' },
        { category: 'Retail Individual (RII)', noOfSharesOffered: '—', noOfTime: i.retailSubscription.toFixed(2), noOfsharesBid: '—' },
        ...(i.employeeSubscription !== undefined
          ? [{ category: 'Employees', noOfSharesOffered: '—', noOfTime: i.employeeSubscription.toFixed(2), noOfsharesBid: '—' }]
          : []),
      ]
    : [];
  return {
    symbol: i.symbol,
    companyName: i.companyName,
    series: i.series,
    status: legacyStatus(i.status),
    issueStartDate: i.openDate,
    issueEndDate: i.closeDate,
    issuePrice: i.priceBand,
    lotSize: i.lotSize,
    minInvestment: i.minInvestment ?? 0,
    issueSizeShares: i.issueSize,
    issueSizeCr: i.issueSizeCr,
    timestamp: i.subscriptionUpdatedAt || i.lastUpdated,
    noOfTimesIssueSubscribed: i.hasSubscriptionData ? i.currentSubscription.toFixed(2) : undefined,
    bidDetails,
    biddingDetails: {},
    graphData: [],
    registrarName: i.registrar,
    registrarUrl: i.registrarUrl || '',
    registrarSlug: (i.registrarSlug && KNOWN_SLUGS.has(i.registrarSlug) ? i.registrarSlug : 'other') as LiveIpoDetail['registrarSlug'],
    retailSubscription: i.hasSubscriptionData ? i.retailSubscription : undefined,
    niiSubscription: i.hasSubscriptionData ? i.niiSubscription : undefined,
    qibSubscription: i.hasSubscriptionData ? i.qibSubscription : undefined,
    employeeSubscription: i.employeeSubscription,
    remainingTime: i.remainingTime,
    isListed: i.isListed,
    listingPrice: i.listingPrice,
    currentPrice: i.currentPrice,
    previousClose: i.previousClose,
    dayChange: i.dayChange,
    dayChangePercent: i.dayChangePercent,
    volume: i.volume,
    gmpEstimate: i.hasGmpData || i.isAiPredictedGmp ? i.gmp : undefined,
    expectedListingGainPct: i.hasGmpData || i.isAiPredictedGmp ? i.gmpPercent : undefined,
  };
}
