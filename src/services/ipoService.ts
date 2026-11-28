import {
  LiveMarketIpoItem,
  LiveMarketOverviewResponse,
  IpoSubscriptionDetails,
  GmpTrendResponse,
  MarketAlertItem,
} from '@/types/liveMarket';
import { IPODataProvider, NSEIPOProvider, MockIPOProvider, isIpoListed } from './ipoDataProvider';
import { MarketService } from './marketService';
import { GmpService } from './gmpService';
import { SubscriptionService } from './subscriptionService';
import { SupabaseIpoProvider } from './supabaseIpoProvider';
import { IpoRepository } from '@/lib/repositories/ipo.repository';
import { isDatabaseConfigured } from '@/db';
import { readSyncHealth } from '@/lib/ingestion/sync-health';

export class IpoService {
  private static nseProvider = new NSEIPOProvider();
  private static mockProvider = new MockIPOProvider();
  private static supabaseProvider = new SupabaseIpoProvider();
  private static latestIposCache: LiveMarketIpoItem[] = [];

  /**
   * Determine whether to use mock demo IPO data or live exchange scraping
   */
  static isMockMode(): boolean {
    return process.env.USE_MOCK_MARKET_DATA === 'true';
  }

  /**
   * Supabase is the store for every IPO shown (kept fresh by /api/scraper/sync). The legacy
   * scraping provider is only used when no database is configured at all.
   */
  static getProvider(): IPODataProvider {
    if (this.isMockMode()) return this.mockProvider;
    return isDatabaseConfigured() ? this.supabaseProvider : this.nseProvider;
  }

  /**
   * Generates overall Live Market Dashboard summary statistics
   */
  static async getOverview(): Promise<LiveMarketOverviewResponse> {
    const provider = this.getProvider();
    const all = await provider.getAllIpos();
    this.latestIposCache = all;

    const listed = all.filter((i) => isIpoListed(i));
    const primary = all.filter((i) => !isIpoListed(i));
    const upcoming = primary.filter((i) => i.status === 'Upcoming' && i.remainingTime !== 'Bidding Closed');
    const open = primary.filter((i) => i.status === 'Open' && i.remainingTime !== 'Bidding Closed');
    const closingSoon = primary.filter((i) => i.status === 'Open' && i.isClosingSoon && i.remainingTime !== 'Bidding Closed');

    // Top Gainer strictly among listed secondary market stocks
    const validGainers = listed.filter((i) => i.currentPrice && i.dayChangePercent !== undefined);
    const topGainer = validGainers.length > 0
      ? [...validGainers].sort((a, b) => (b.dayChangePercent || 0) - (a.dayChangePercent || 0))[0]
      : (listed.length > 0 ? listed[0] : undefined);

    // Highest Subscribed strictly among primary market offerings
    const validSubscribed = primary.filter((i) => (i.currentSubscription || 0) > 0);
    const topSubscribed = validSubscribed.length > 0
      ? [...validSubscribed].sort((a, b) => (b.currentSubscription || 0) - (a.currentSubscription || 0))[0]
      : (primary.length > 0 ? primary[0] : undefined);

    // Highest estimated GMP strictly among primary market offerings
    const validGmp = primary.filter((i) => (i.gmp || 0) > 0);
    const topGmp = validGmp.length > 0
      ? [...validGmp].sort((a, b) => (b.gmpPercent || 0) - (a.gmpPercent || 0))[0]
      : (primary.length > 0 ? primary[0] : undefined);

    return {
      success: true,
      marketStatus: MarketService.getMarketStatus(),
      connectionStatus: this.isMockMode() ? 'DEMO' : 'LIVE',
      isMock: this.isMockMode(),
      lastUpdated: await this.dataAsOf(),
      overview: {
        upcomingCount: upcoming.length,
        openCount: open.length,
        closingSoonCount: closingSoon.length,
        recentlyListedCount: listed.length,
        totalTrackedCount: all.length,
      },
      topGainer,
      topSubscribed,
      topGmp,
    };
  }

  /** "As of" time for the dashboard: the last successful sync into Supabase, in IST. */
  private static async dataAsOf(): Promise<string> {
    const fmt = (d: Date) =>
      d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    if (this.getProvider() !== this.supabaseProvider) return fmt(new Date());
    const health = await readSyncHealth().catch(() => null);
    return health?.lastSuccessAt ? fmt(new Date(health.lastSuccessAt)) : 'not synced yet';
  }

  static async getAllIpos(): Promise<LiveMarketIpoItem[]> {
    return this.getProvider().getAllIpos();
  }

  static async getUpcomingIpos(): Promise<LiveMarketIpoItem[]> {
    return this.getProvider().getUpcomingIpos();
  }

  static async getOpenIpos(): Promise<LiveMarketIpoItem[]> {
    return this.getProvider().getOpenIpos();
  }

  static async getClosedIpos(): Promise<LiveMarketIpoItem[]> {
    return this.getProvider().getClosedIpos();
  }

  static async getListedIpos(): Promise<LiveMarketIpoItem[]> {
    return this.getProvider().getListedIpos();
  }

  static async getIpoDetails(idOrSymbol: string): Promise<LiveMarketIpoItem | null> {
    return this.getProvider().getIpoDetails(idOrSymbol);
  }

  static async getSubscription(idOrSymbol: string): Promise<IpoSubscriptionDetails | null> {
    const ipo = await this.getIpoDetails(idOrSymbol);
    if (!ipo) return null;

    if (this.getProvider() === this.supabaseProvider) {
      if (!ipo.hasSubscriptionData) return null;
      return {
        symbol: ipo.symbol,
        companyName: ipo.companyName,
        retail: ipo.retailSubscription,
        nii: ipo.niiSubscription,
        qib: ipo.qibSubscription,
        employee: ipo.employeeSubscription,
        total: ipo.currentSubscription,
        allotmentDate: ipo.allotmentDate,
        listingDate: ipo.listingDate,
        recordedAt: ipo.subscriptionUpdatedAt || ipo.lastUpdated || new Date().toISOString(),
      };
    }

    return SubscriptionService.getSubscriptionDetails(
      ipo.symbol,
      ipo.companyName,
      ipo.currentSubscription,
      ipo.retailSubscription,
      ipo.niiSubscription,
      ipo.qibSubscription,
      ipo.employeeSubscription
    );
  }

  static async getGmp(idOrSymbol: string): Promise<{ symbol: string; gmp: number; gmpPercent: number; disclaimer: string } | null> {
    const ipo = await this.getIpoDetails(idOrSymbol);
    if (!ipo) return null;

    return {
      symbol: ipo.symbol,
      gmp: ipo.gmp,
      gmpPercent: ipo.gmpPercent,
      disclaimer: 'Grey Market Premium (GMP) is an unofficial, unregulated indicator and does not represent an official exchange price.',
    };
  }

  static async getGmpHistory(
    idOrSymbol: string,
    timeframe: '1D' | '7D' | '1M' | 'All' = '7D'
  ): Promise<GmpTrendResponse | null> {
    const ipo = await this.getIpoDetails(idOrSymbol);
    if (!ipo) return null;

    if (this.getProvider() === this.supabaseProvider) {
      return this.getStoredGmpHistory(ipo, timeframe);
    }

    return GmpService.getGmpHistory(
      ipo.symbol,
      ipo.companyName,
      ipo.gmp ?? 0,
      ipo.priceHigh || ipo.priceLow || 100,
      timeframe
    );
  }

  /** Real recorded GMP points (InvestorGain daily history + sync readings). No synthetic curve. */
  private static async getStoredGmpHistory(
    ipo: LiveMarketIpoItem,
    timeframe: '1D' | '7D' | '1M' | 'All'
  ): Promise<GmpTrendResponse> {
    const rawAll = await IpoRepository.gmpHistory(ipo.symbol);
    const all = [...rawAll].sort((a, b) => a.date.localeCompare(b.date) || a.fetchedAt.localeCompare(b.fetchedAt));
    const days = timeframe === '1D' ? 1 : timeframe === '7D' ? 7 : timeframe === '1M' ? 31 : Infinity;
    const cutoff = Number.isFinite(days) ? Date.now() - days * 86_400_000 : -Infinity;
    // Keep at least the latest point so a quiet week still shows the last known GMP.
    let rows = all.filter((p) => new Date(`${p.date}T12:00:00+05:30`).getTime() >= cutoff);
    if (!rows.length && all.length) rows = all.slice(-1);
    const price = ipo.priceHigh || 0;
    const points = rows.map((p) => {
      const ts = new Date(`${p.date}T12:00:00+05:30`).getTime();
      return {
        date: p.date,
        timestamp: ts,
        gmp: p.gmp,
        gmpPercent: p.gmpPercent ?? (price ? Math.round((p.gmp / price) * 10000) / 100 : undefined),
        estimatedListingPrice: price ? price + p.gmp : undefined,
      };
    });
    const values = points.map((p) => p.gmp);
    const latest = all[all.length - 1];
    const sources = [...new Set(rows.map((r) => r.source))].map((name) => {
      const last = [...rows].reverse().find((r) => r.source === name)!;
      return { sourceName: name, gmp: last.gmp, lastUpdated: last.fetchedAt, reliability: 'UNOFFICIAL' as const };
    });
    return {
      symbol: ipo.symbol,
      companyName: ipo.companyName,
      currentGmp: latest ? latest.gmp : 0,
      gmpChange: values.length > 1 ? values[values.length - 1] - values[0] : 0,
      highestGmp: values.length ? Math.max(...values) : 0,
      lowestGmp: values.length ? Math.min(...values) : 0,
      timeframe,
      points,
      history: points,
      sources,
      disclaimer: all.length
        ? 'Grey Market Premium is an unofficial, unregulated indication recorded from InvestorGain. It is not an exchange price.'
        : 'No GMP has been recorded for this IPO yet.',
      freshnessLabel: latest ? `As of ${latest.date}` : 'No data',
    };
  }

  /**
   * Notification-ready simulated/real alert queue dynamically generated from live market data
   */
  static getAlerts(items?: LiveMarketIpoItem[]): MarketAlertItem[] {
    const all = items && items.length > 0 ? items : this.latestIposCache;
    const alerts: MarketAlertItem[] = [];

    const open = all.filter((i) => i.status === 'Open');
    const listed = all.filter((i) => i.status === 'Listed');
    const topGmp = all.filter((i) => i.gmp > 0).sort((a, b) => b.gmpPercent - a.gmpPercent)[0];
    const topGainer = listed.filter((i) => i.currentPrice).sort((a, b) => (b.dayChangePercent || 0) - (a.dayChangePercent || 0))[0];
    const closingSoon = open.find((i) => i.isClosingSoon || i.remainingTime?.includes('Hours'));

    if (open.length > 0) {
      const active = open[0];
      alerts.push({
        id: `alert-open-${active.symbol}`,
        type: 'SUBSCRIPTION',
        title: 'Active Primary Bidding',
        message: `${active.companyName} (${active.symbol}) bidding window is open on exchange${active.currentSubscription > 0 ? ` (${active.currentSubscription}x subscribed)` : ''}.`,
        symbol: active.symbol,
        timestamp: 'Live Feed',
        read: false,
      });
    }

    if (topGmp) {
      alerts.push({
        id: `alert-gmp-${topGmp.symbol}`,
        type: 'GMP',
        title: 'GMP Surge Detected',
        message: `${topGmp.companyName} estimated GMP trading at +₹${topGmp.gmp} (+${topGmp.gmpPercent}%).`,
        symbol: topGmp.symbol,
        timestamp: 'Live Market',
        read: false,
      });
    }

    if (closingSoon) {
      alerts.push({
        id: `alert-closing-${closingSoon.symbol}`,
        type: 'CLOSING_SOON',
        title: 'Bidding Window Closing',
        message: `${closingSoon.companyName} (${closingSoon.symbol}) issue closes on ${closingSoon.closeDate}.`,
        symbol: closingSoon.symbol,
        timestamp: 'Action Required',
        read: false,
      });
    }

    if (topGainer && topGainer.currentPrice) {
      alerts.push({
        id: `alert-move-${topGainer.symbol}`,
        type: 'PRICE_MOVE',
        title: 'Post-Listing Outperformer',
        message: `${topGainer.companyName} gained ${(topGainer.dayChangePercent || 0) >= 0 ? '+' : ''}${topGainer.dayChangePercent}% intraday, trading at ₹${topGainer.currentPrice.toFixed(2)}.`,
        symbol: topGainer.symbol,
        timestamp: 'Live Secondary Feed',
        read: true,
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        id: 'alert-default-live',
        type: 'SUBSCRIPTION',
        title: 'Live Market Telemetry Active',
        message: 'Real-time primary exchange gateway synchronized.',
        symbol: 'MARKET',
        timestamp: 'Live Feed',
        read: false,
      });
    }

    return alerts;
  }
}
