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

export class IpoService {
  private static nseProvider = new NSEIPOProvider();
  private static mockProvider = new MockIPOProvider();
  private static latestIposCache: LiveMarketIpoItem[] = [];

  /**
   * Determine whether to use mock demo IPO data or live exchange scraping
   */
  static isMockMode(): boolean {
    return process.env.USE_MOCK_MARKET_DATA === 'true';
  }

  static getProvider(): IPODataProvider {
    return this.isMockMode() ? this.mockProvider : this.nseProvider;
  }

  /**
   * Generates overall Live Market Dashboard summary statistics
   */
  static async getOverview(): Promise<LiveMarketOverviewResponse> {
    const provider = this.getProvider();
    const all = await provider.getAllIpos();
    this.latestIposCache = all;

    const listed = all.filter((i) => isIpoListed(i));
    const upcoming = all.filter((i) => !isIpoListed(i) && i.status === 'Upcoming' && i.remainingTime !== 'Bidding Closed');
    const open = all.filter((i) => !isIpoListed(i) && i.status === 'Open' && i.remainingTime !== 'Bidding Closed');
    const closingSoon = all.filter((i) => !isIpoListed(i) && i.status === 'Open' && i.isClosingSoon && i.remainingTime !== 'Bidding Closed');

    // Top Gainer among listed IPOs
    const validGainers = listed.filter((i) => i.currentPrice && i.dayChangePercent !== undefined);
    const topGainer = validGainers.length > 0
      ? [...validGainers].sort((a, b) => (b.dayChangePercent || 0) - (a.dayChangePercent || 0))[0]
      : (listed.length > 0 ? listed[0] : undefined);

    // Highest Subscribed among open/closed IPOs
    const topSubscribed = all.length > 0
      ? [...all].sort((a, b) => b.currentSubscription - a.currentSubscription)[0]
      : undefined;

    // Highest estimated GMP
    const topGmp = all.length > 0
      ? [...all].sort((a, b) => b.gmpPercent - a.gmpPercent)[0]
      : undefined;

    return {
      success: true,
      marketStatus: MarketService.getMarketStatus(),
      connectionStatus: this.isMockMode() ? 'DEMO' : 'LIVE',
      isMock: this.isMockMode(),
      lastUpdated: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
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

    return GmpService.getGmpHistory(
      ipo.symbol,
      ipo.companyName,
      ipo.gmp ?? 0,
      ipo.priceHigh || ipo.priceLow || 100,
      timeframe
    );
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
