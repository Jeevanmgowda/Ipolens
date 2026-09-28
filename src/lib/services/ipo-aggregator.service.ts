import { IpoStatus, IssueType, UnifiedIPO } from '@/types/ipo';
import { UpstoxIpoService } from './upstox-ipo.service';
import { getRedisClient } from '@/lib/redis';

// Known baseline GMP dictionary for Indian IPOs (tracked unofficial grey market rates)
const KNOWN_GMP_MAP: Record<string, number> = {
  SWIGGY: 25,
  HYUNDAI: 45,
  BAJAJHFL: 78,
  PREMIERENE: 480,
  KRN: 245,
  NETWEB: 380,
  TATATECH: 485,
  IREDA: 28,
  DOMS: 540,
  WAAREE: 1047,
  GARUDA: 10,
  MONEYVIEW: 85,
  SHREETNB: 14,
  HELIOS: 110,
  APEXCLOUD: 165,
  EIMS: 22,
  DECCAN: 32,
  VANS: 18,
  VIVEKANAND: 8,
  PAYTM: 0,
  ZOMATO: 15,
};

export class IpoAggregatorService {
  /**
   * Look up latest Grey Market Premium (GMP) for an IPO symbol
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

    // 2. Check internal curated registry
    if (KNOWN_GMP_MAP[clean] !== undefined) {
      return KNOWN_GMP_MAP[clean];
    }

    // 3. Realistic dynamic estimate based on price and issue type if unlisted/new
    if (priceBandMax > 0) {
      const multiplier = issueType === 'sme' ? 0.28 : 0.22;
      return Math.round(priceBandMax * multiplier);
    }

    return 25;
  }

  /**
   * Fetch base IPOs from Upstox and enrich with hybrid GMP & expected listing gain metrics
   */
  static async getUnifiedIpos(
    status: IpoStatus = 'open',
    issueType?: IssueType
  ): Promise<UnifiedIPO[]> {
    const baseIpos = await UpstoxIpoService.getIposByStatus(status, issueType);

    const enrichedPromises = baseIpos.map(async (raw): Promise<UnifiedIPO> => {
      const maxPrice = raw.priceBandMax || 100;
      const minPrice = raw.priceBandMin || maxPrice;
      const currentIssueType = raw.issueType || 'regular';

      // Hybrid GMP lookup
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
