import {
  LiveMarketIpoItem,
  LiveMarketOverviewResponse,
  IpoSubscriptionDetails,
  GmpTrendResponse,
  MarketAlertItem,
} from '@/types/liveMarket';
import { IPODataProvider, NSEIPOProvider, MockIPOProvider } from './ipoDataProvider';
import { MarketService } from './marketService';
import { GmpService } from './gmpService';
import { SubscriptionService } from './subscriptionService';

export class IpoService {
  private static nseProvider = new NSEIPOProvider();
  private static mockProvider = new MockIPOProvider();

  /**
   * Determine whether to use mock demo IPO data or live scraping
   */
  static isMockMode(): boolean {
    const envVal = process.env.USE_MOCK_MARKET_DATA;
    if (envVal === 'false') {
      return false;
    }
    return true; // Default to free-development mode
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

    const upcoming = all.filter((i) => i.status === 'Upcoming');
    const open = all.filter((i) => i.status === 'Open');
    const closingSoon = all.filter((i) => i.status === 'Open' && i.isClosingSoon);
    const listed = all.filter((i) => i.status === 'Listed');

    // Top Gainer among listed IPOs
    const topGainer = listed.length > 0
      ? [...listed].sort((a, b) => (b.dayChangePercent || 0) - (a.dayChangePercent || 0))[0]
      : undefined;

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
      ipo.gmp || 75,
      ipo.priceHigh || 450,
      timeframe
    );
  }

  /**
   * Notification-ready simulated/real alert queue
   */
  static getAlerts(): MarketAlertItem[] {
    return [
      {
        id: 'alert-1',
        type: 'SUBSCRIPTION',
        title: 'Subscription Threshold Alert',
        message: 'Helios Green Energy crossed 20x overall book subscription (now 24.15x).',
        symbol: 'HELIOS',
        timestamp: '10 mins ago',
        read: false,
      },
      {
        id: 'alert-2',
        type: 'GMP',
        title: 'GMP Surge Detected',
        message: 'Demo Technologies Ltd GMP expanded by +₹12 to ₹72 (+15.1%).',
        symbol: 'DEMOTECH',
        timestamp: '25 mins ago',
        read: false,
      },
      {
        id: 'alert-3',
        type: 'CLOSING_SOON',
        title: 'Bidding Window Closing',
        message: 'Demo Technologies Ltd window closes today at 5:00 PM IST.',
        symbol: 'DEMOTECH',
        timestamp: '1 hour ago',
        read: false,
      },
      {
        id: 'alert-4',
        type: 'PRICE_MOVE',
        title: 'Post-Listing Outperformer',
        message: 'Premier Energies gained +2.98% intraday, trading at ₹1,120.40.',
        symbol: 'PREMIERENE',
        timestamp: '2 hours ago',
        read: true,
      },
    ];
  }
}
