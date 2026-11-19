import { IpoStatus, IssueType, UnifiedIPO } from '@/types/ipo';
import { UpstoxIpoService } from './upstox-ipo.service';
import { getRedisClient } from '@/lib/redis';
import { isFalseOrDemoSymbol, isSameIpo } from '@/lib/utils/ipoDeduplication';

export class IpoAggregatorService {
  /**
   * Look up latest Grey Market Premium (GMP) dynamically from live scraped feeds
   */
  static async getGmpForSymbol(symbol: string, priceBandMax: number, issueType: IssueType): Promise<number> {
    const clean = (symbol || '').toUpperCase().trim();

    // 1. Check Redis for live scraped or updated GMP
    try {
      const redis = getRedisClient();
      const cachedGmp = await redis.get(`gmp:${clean}`);
      if (cachedGmp !== null && cachedGmp !== undefined && !isNaN(Number(cachedGmp))) {
        return Number(cachedGmp);
      }
    } catch {
      // Redis optional
    }

    // 2. Query live scraped grey market tracker from market websites
    try {
      const { getLiveScrapedGmp } = await import('@/services/nseIpoService');
      const liveGmp = await getLiveScrapedGmp(clean);
      if (liveGmp !== null && liveGmp !== undefined && !isNaN(liveGmp)) {
        return liveGmp;
      }
    } catch {
      // optional
    }

    // 3. Newly announced issue with no active OTC quote trades at flat baseline
    return 0;
  }

  /**
   * Fetch base IPOs from live Upstox & NSE exchange telemetry, enriching with live GMP
   */
  static async getUnifiedIpos(
    status: IpoStatus = 'open',
    issueType?: IssueType
  ): Promise<UnifiedIPO[]> {
    const baseIpos = await UpstoxIpoService.getIposByStatus(status, issueType);

    // Also fetch live NSE issues if any additional live items exist
    let nseIpos: Partial<UnifiedIPO>[] = [];
    try {
      const { fetchLiveNseIpos } = await import('@/services/nseIpoService');
      const nseList = await fetchLiveNseIpos();
      nseIpos = nseList
        .filter((i) => {
          const isListed = Boolean(i.isListed || i.status === 'Listed');
          if (status === 'listed') return isListed;
          if (isListed) return false;
          const isClosed = i.status === 'Closed' || i.remainingTime === 'Bidding Closed';
          if (isClosed) return status === 'closed';
          const s = i.status === 'Active' ? 'open' : 'upcoming';
          return s === status;
        })
        .map((i) => {
          const cleanPriceStr = (i.priceBand || i.issuePrice || '100').replace(/,/g, '');
          const prices = cleanPriceStr.match(/\d+(?:\.\d+)?/g) || ['100'];
          const maxPrice = i.priceHigh !== undefined ? i.priceHigh : (parseFloat(prices[prices.length - 1]) || 100);
          const minPrice = i.priceLow !== undefined ? i.priceLow : (parseFloat(prices[0]) || maxPrice);
          const currentType: IssueType = i.series === 'SME' ? 'sme' : 'regular';
          const isClosed = i.status === 'Closed' || i.remainingTime === 'Bidding Closed';
          const itemStatus: 'upcoming' | 'open' | 'closed' | 'listed' =
            i.isListed ? 'listed' : isClosed ? 'closed' : i.status === 'Active' ? 'open' : 'upcoming';
          return {
            id: `${i.symbol.toLowerCase()}-ipo`,
            symbol: i.symbol.toUpperCase(),
            companyName: i.companyName,
            issueType: currentType,
            status: itemStatus,
            priceBandMin: minPrice,
            priceBandMax: maxPrice,
            lotSize: typeof i.lotSize === 'number' ? i.lotSize : (i.lotSize ? parseInt(String(i.lotSize).replace(/,/g, ''), 10) : (currentType === 'sme' ? 1600 : 14)),
            openDate: i.issueStartDate,
            closeDate: i.issueEndDate,
            issueSizeInCrores: i.issueSize ? parseFloat(i.issueSize.replace(/[^0-9.]/g, '')) : undefined,
            subscriptionTotal: parseFloat(i.noOfTime || '0') || undefined,
            subscriptionRetail: i.retailSubscription,
            subscriptionHni: i.niiSubscription,
            subscriptionQib: i.qibSubscription,
            registrar: i.registrarName,
            instrumentKey: `NSE_EQ|${i.symbol.toUpperCase()}`,
          };
        });
      if (issueType) {
        nseIpos = nseIpos.filter((i) => i.issueType === issueType);
      }
    } catch {
      // ignore
    }

    // Merge Upstox and NSE without duplicates or false symbols
    const combined: Partial<UnifiedIPO>[] = [];
    for (const item of [...baseIpos, ...nseIpos]) {
      if (!item.symbol || isFalseOrDemoSymbol(item.symbol)) continue;
      const existingIdx = combined.findIndex((c) =>
        isSameIpo(c.symbol, c.companyName, item.symbol, item.companyName)
      );
      if (existingIdx === -1) {
        combined.push(item);
      } else {
        combined[existingIdx] = { ...combined[existingIdx], ...item };
      }
    }

    const enrichedPromises = combined.map(async (raw): Promise<UnifiedIPO> => {
      const maxPrice = raw.priceBandMax || 100;
      const minPrice = raw.priceBandMin || maxPrice;
      const currentIssueType = raw.issueType || 'regular';

      // Live GMP lookup
      const gmp = await this.getGmpForSymbol(raw.symbol || '', maxPrice, currentIssueType);

      // Formula: (gmp / priceBandMax) * 100
      const expectedListingGainPct = maxPrice > 0 ? Number(((gmp / maxPrice) * 100).toFixed(2)) : 0;

      const normalizedStatus: 'upcoming' | 'open' | 'closed' | 'listed' =
        raw.status === 'upcoming' || raw.status === 'open' || raw.status === 'closed' || raw.status === 'listed'
          ? raw.status
          : 'open';

      return {
        id: raw.id || `${(raw.symbol || 'ipo').toLowerCase()}-ipo`,
        symbol: raw.symbol || 'IPO',
        companyName: raw.companyName || raw.symbol || 'Unknown Company',
        issueType: currentIssueType,
        status: normalizedStatus,
        priceBandMin: minPrice,
        priceBandMax: maxPrice,
        lotSize: raw.lotSize || (currentIssueType === 'sme' ? 1200 : 35),
        openDate: raw.openDate || '',
        closeDate: raw.closeDate || '',
        listingDate: raw.listingDate,
        issueSizeInCrores: raw.issueSizeInCrores,
        subscriptionTotal: raw.subscriptionTotal,
        subscriptionRetail: raw.subscriptionRetail,
        subscriptionHni: raw.subscriptionHni,
        subscriptionQib: raw.subscriptionQib,
        registrar: raw.registrar,
        instrumentKey: raw.instrumentKey,
        gmp,
        expectedListingGainPct,
      };
    });

    return Promise.all(enrichedPromises);
  }

  /**
   * Fetch single Unified IPO record by ID with full metrics & GMP
   */
  static async getUnifiedIpoById(id: string): Promise<UnifiedIPO | null> {
    const raw = await UpstoxIpoService.getIpoDetails(id);
    if (!raw) return null;

    const maxPrice = raw.priceBandMax || 100;
    const minPrice = raw.priceBandMin || maxPrice;
    const issueType = raw.issueType || 'regular';

    const gmp = await this.getGmpForSymbol(raw.symbol || '', maxPrice, issueType);
    const expectedListingGainPct = maxPrice > 0 ? Number(((gmp / maxPrice) * 100).toFixed(2)) : 0;

    const normalizedStatus: 'upcoming' | 'open' | 'closed' | 'listed' =
      raw.status === 'upcoming' || raw.status === 'open' || raw.status === 'closed' || raw.status === 'listed'
        ? raw.status
        : 'open';

    return {
      id: raw.id || id,
      symbol: raw.symbol || 'IPO',
      companyName: raw.companyName || raw.symbol || 'Unknown Company',
      issueType,
      status: normalizedStatus,
      priceBandMin: minPrice,
      priceBandMax: maxPrice,
      lotSize: raw.lotSize || (issueType === 'sme' ? 1200 : 35),
      openDate: raw.openDate || '',
      closeDate: raw.closeDate || '',
      listingDate: raw.listingDate,
      issueSizeInCrores: raw.issueSizeInCrores,
      subscriptionTotal: raw.subscriptionTotal,
      subscriptionRetail: raw.subscriptionRetail,
      subscriptionHni: raw.subscriptionHni,
      subscriptionQib: raw.subscriptionQib,
      registrar: raw.registrar,
      instrumentKey: raw.instrumentKey,
      gmp,
      expectedListingGainPct,
    };
  }
}
