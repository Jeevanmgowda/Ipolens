import { IpoRepository, todayIst } from '@/lib/repositories/ipo.repository';
import type {
  LiveMarketIpoItem,
  LiveMarketOverviewResponse,
  IpoSubscriptionDetails,
  GmpTrendResponse,
  MarketAlertItem,
} from '@/types/liveMarket';

/**
 * Read facade over the IPO repository. All data comes from the database populated by the
 * ingestion job; nothing here fabricates or defaults values.
 */

export const GMP_DISCLAIMER =
  'Grey Market Premium (GMP) is an informal, unregulated indication reported by third-party trackers. ' +
  'It is not an official price and is not investment advice. The AI estimate is a statistical model output.';

const findItem = async (idOrSymbol: string): Promise<LiveMarketIpoItem | null> => {
  const key = idOrSymbol.toUpperCase();
  const items = await IpoRepository.listView();
  return items.find((i) => i.symbol === key || i.id.toUpperCase() === key) ?? null;
};

export class IpoService {
  static async getAllIpos() {
    return IpoRepository.listView();
  }
  static async getUpcomingIpos() {
    return IpoRepository.listView({ status: 'Upcoming' });
  }
  static async getOpenIpos() {
    return IpoRepository.listView({ status: 'Open' });
  }
  static async getClosedIpos() {
    return IpoRepository.listView({ status: 'Closed' });
  }
  static async getListedIpos() {
    const items = await IpoRepository.listView({ status: 'Listed' });
    return items.sort((a, b) => (b.listingDate || '').localeCompare(a.listingDate || ''));
  }
  static async getIpoDetails(idOrSymbol: string) {
    return findItem(idOrSymbol);
  }

  static async getSubscription(idOrSymbol: string): Promise<IpoSubscriptionDetails | null> {
    const item = await findItem(idOrSymbol);
    if (!item) return null;
    const sub = await IpoRepository.latestSubscription(item.symbol);
    if (!sub) return null;
    return {
      symbol: item.symbol,
      companyName: item.companyName,
      retail: sub.retail,
      nii: sub.nii,
      qib: sub.qib,
      employee: sub.employee ?? undefined,
      total: sub.total,
      allotmentDate: item.allotmentDate ?? undefined,
      listingDate: item.listingDate ?? undefined,
      recordedAt: sub.recordedAt,
    };
  }

  static async getGmpHistory(idOrSymbol: string, timeframe: GmpTrendResponse['timeframe']): Promise<GmpTrendResponse | null> {
    const item = await findItem(idOrSymbol);
    if (!item) return null;
    const all = await IpoRepository.gmpHistory(item.symbol);
    if (!all.length) return null;
    const days = timeframe === '1D' ? 1 : timeframe === '7D' ? 7 : timeframe === '1M' ? 31 : 3650;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const pts = all.filter((p) => timeframe === 'All' || p.date >= cutoff);
    const usePts = pts.length ? pts : all.slice(-1);
    const points = usePts.map((p) => ({
      date: p.date,
      timestamp: new Date(`${p.date}T12:00:00+05:30`).getTime(),
      gmp: p.gmp,
      gmpPercent: p.gmpPercent ?? undefined,
      estimatedListingPrice: item.priceHigh !== null ? item.priceHigh + p.gmp : undefined,
    }));
    const values = points.map((p) => p.gmp);
    const last = all[all.length - 1];
    return {
      symbol: item.symbol,
      companyName: item.companyName,
      currentGmp: last.gmp,
      gmpChange: points.length > 1 ? points[points.length - 1].gmp - points[0].gmp : 0,
      highestGmp: Math.max(...values),
      lowestGmp: Math.min(...values),
      timeframe,
      points,
      history: points,
      disclaimer: GMP_DISCLAIMER,
      sources: [{ sourceName: last.source, gmp: last.gmp, lastUpdated: last.fetchedAt, reliability: 'UNOFFICIAL' }],
      freshnessLabel: `Updated ${new Date(last.fetchedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
    };
  }

  static async getOverview(): Promise<LiveMarketOverviewResponse> {
    const items = await IpoRepository.listView();
    const today = todayIst();
    const in2Days = todayIst(new Date(Date.now() + 2 * 86400000));
    const open = items.filter((i) => i.status === 'Open');
    const listed = items.filter((i) => i.status === 'Listed');
    const recent = listed.filter((i) => i.listingDate && i.listingDate >= todayIst(new Date(Date.now() - 30 * 86400000)));
    const closingSoon = open.filter((i) => i.closeDate && i.closeDate >= today && i.closeDate <= in2Days);
    const byMax = <T,>(arr: T[], f: (t: T) => number | null | undefined) =>
      arr.filter((x) => f(x) !== null && f(x) !== undefined).sort((a, b) => (f(b) as number) - (f(a) as number))[0];
    const lastUpdated = items.map((i) => i.lastUpdated || '').sort().pop() || null;
    const istHour = new Date(Date.now() + 5.5 * 3600000);
    const minutes = istHour.getUTCHours() * 60 + istHour.getUTCMinutes();
    const weekday = istHour.getUTCDay();
    return {
      success: true,
      marketStatus: weekday >= 1 && weekday <= 5 && minutes >= 555 && minutes <= 930 ? 'OPEN' : 'CLOSED',
      connectionStatus: items.length ? 'LIVE' : 'DISCONNECTED',
      isMock: false,
      lastUpdated: lastUpdated || new Date(0).toISOString(),
      overview: {
        upcomingCount: items.filter((i) => i.status === 'Upcoming').length,
        openCount: open.length,
        closingSoonCount: closingSoon.length,
        recentlyListedCount: recent.length,
        totalTrackedCount: items.length,
      },
      topGainer: byMax(recent, (i) => i.listingGainPct),
      topSubscribed: byMax(open, (i) => i.currentSubscription),
      topGmp: byMax([...open, ...items.filter((i) => i.status === 'Upcoming')], (i) => i.gmpPercent),
    };
  }

  /** Alerts derived from real state: closing soon, allotment today, listing today. */
  static async getAlerts(): Promise<MarketAlertItem[]> {
    const items = await IpoRepository.listView();
    const today = todayIst();
    const alerts: MarketAlertItem[] = [];
    for (const i of items) {
      if (i.status === 'Open' && i.closeDate === today) {
        alerts.push({
          id: `close_${i.symbol}`,
          type: 'CLOSING_SOON',
          title: `${i.companyName} closes today`,
          message: `Bidding for ${i.symbol} closes today${i.currentSubscription !== null ? ` (subscribed ${i.currentSubscription}x so far)` : ''}.`,
          symbol: i.symbol,
          timestamp: new Date().toISOString(),
          read: false,
        });
      }
      if (i.allotmentDate === today) {
        alerts.push({
          id: `allot_${i.symbol}`,
          type: 'ALLOTMENT',
          title: `${i.companyName} allotment today`,
          message: `Basis of allotment for ${i.symbol} is expected today. Check your family PANs in the Allotment tab.`,
          symbol: i.symbol,
          timestamp: new Date().toISOString(),
          read: false,
        });
      }
      if (i.listingDate === today) {
        alerts.push({
          id: `list_${i.symbol}`,
          type: 'LISTED',
          title: `${i.companyName} lists today`,
          message: `${i.symbol} is scheduled to list on ${i.series === 'SME' ? 'the SME platform' : 'the exchanges'} today.`,
          symbol: i.symbol,
          timestamp: new Date().toISOString(),
          read: false,
        });
      }
    }
    return alerts;
  }
}
