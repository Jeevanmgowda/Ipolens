import { IpoStatus, IssueType, UnifiedIPO } from '@/types/ipo';
import { getRedisClient } from '@/lib/redis';

interface UpstoxIpoItem {
  id: string;
  symbol: string;
  name: string;
  status: string;
  isin?: string;
  issue_type?: string;
  issue_size?: number;
  industry?: string;
  minimum_price?: number;
  maximum_price?: number;
  bidding_start_date?: string;
  bidding_end_date?: string;
  daily_start_time?: string;
  daily_end_time?: string;
  face_value?: number;
  lot_size?: number;
  minimum_quantity?: number;
  cut_off_price?: number;
  listing_price?: number;
  listing_exchange?: string;
  timeline?: {
    pre_apply_start_date?: string;
    application_start_date?: string;
    application_end_date?: string;
    allotment_start_date?: string;
    allotment_date?: string;
    refund_initiation_date?: string;
    listing_date?: string;
    mandate_end_date?: string;
  };
  registrar_info?: {
    name?: string;
    email?: string;
    website?: string;
    registrar?: string;
  };
  total_subscription?: string | number;
  investors?: Array<{
    category?: string;
    description?: string;
    subscription_rate?: string | number;
  }>;
}

export class UpstoxIpoService {
  private static baseUrl = 'https://api.upstox.com/v2';
  private static memoryCache = new Map<string, { data: any; expiry: number }>();
  private static CACHE_TTL_SECONDS = 240; // 4 minutes

  /**
   * Resolve Upstox Developer Access Token from environment
   */
  private static getAccessToken(): string {
    const token = process.env.UPSTOX_ACCESS_TOKEN || '';
    if (
      !token ||
      token.includes('your_') ||
      token.includes('YOUR_') ||
      token.length < 20
    ) {
      return '';
    }
    return token.trim();
  }

  /**
   * Fetch IPOs by lifecycle status and optional issue type
   */
  static async getIposByStatus(
    status: IpoStatus,
    issueType?: IssueType
  ): Promise<Partial<UnifiedIPO>[]> {
    const normalizedStatus = this.normalizeStatus(status);
    const cacheKey = `upstox:ipos:${normalizedStatus}:${issueType || 'all'}`;

    // 1. Check in-memory cache
    const memCached = this.memoryCache.get(cacheKey);
    if (memCached && Date.now() < memCached.expiry) {
      return memCached.data;
    }

    // 2. Check Redis cache
    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        this.memoryCache.set(cacheKey, { data: parsed, expiry: Date.now() + 60000 });
        return parsed;
      }
    } catch {
      // Redis optional
    }

    const token = this.getAccessToken();

    // If no valid token configured, return live market fallback without throwing error
    if (!token) {
      console.warn(`[UpstoxIpoService] UPSTOX_ACCESS_TOKEN not configured or empty. Using live market fallback for status '${status}'.`);
      return await this.getFallbackIpos(normalizedStatus, issueType);
    }

    try {
      let url = `${this.baseUrl}/ipos?status=${encodeURIComponent(normalizedStatus)}`;
      if (issueType) {
        url += `&issue_type=${encodeURIComponent(issueType)}`;
      }

      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(process.env.NODE_ENV === 'test' ? 1000 : 3000),
      });

      if (!res.ok) {
        console.warn(`[UpstoxIpoService] HTTP ${res.status} from ${url}. Falling back to live market data.`);
        return await this.getFallbackIpos(normalizedStatus, issueType);
      }

      const json = await res.json();
      const rawList: UpstoxIpoItem[] = json.data || [];

      if (!Array.isArray(rawList) || rawList.length === 0) {
        return await this.getFallbackIpos(normalizedStatus, issueType);
      }

      const mapped: Partial<UnifiedIPO>[] = rawList.map((item) =>
        this.mapUpstoxItemToUnified(item, normalizedStatus)
      );

      // Filter by issueType if requested
      let filtered = issueType
        ? mapped.filter((i) => i.issueType === issueType)
        : mapped;

      if (filtered.length === 0) {
        const liveFallback = await this.getFallbackIpos(normalizedStatus, issueType);
        if (liveFallback.length > 0) {
          filtered = liveFallback;
        }
      }

      // Cache results
      try {
        const redis = getRedisClient();
        await redis.set(cacheKey, JSON.stringify(filtered), 'EX', this.CACHE_TTL_SECONDS);
      } catch {
        // Redis optional
      }
      this.memoryCache.set(cacheKey, {
        data: filtered,
        expiry: Date.now() + this.CACHE_TTL_SECONDS * 1000,
      });

      return filtered;
    } catch (err: any) {
      console.warn(`[UpstoxIpoService] Error fetching IPOs for status '${status}': ${err.message}. Using live market fallback.`);
      return await this.getFallbackIpos(normalizedStatus, issueType);
    }
  }

  /**
   * Directly fetch live IPOs from Upstox Developer API v2 without mock fallback
   */
  static async fetchLiveFromUpstox(
    status: IpoStatus,
    issueType?: IssueType
  ): Promise<Partial<UnifiedIPO>[]> {
    const token = this.getAccessToken();
    if (!token) return [];

    const normalizedStatus = this.normalizeStatus(status);
    try {
      let url = `${this.baseUrl}/ipos?status=${encodeURIComponent(normalizedStatus)}`;
      if (issueType) {
        url += `&issue_type=${encodeURIComponent(issueType)}`;
      }

      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(process.env.NODE_ENV === 'test' ? 1000 : 3000),
      });

      if (!res.ok) return [];

      const json = await res.json();
      const rawList: UpstoxIpoItem[] = json.data || [];
      if (!Array.isArray(rawList)) return [];

      const mapped = rawList.map((item) => this.mapUpstoxItemToUnified(item, normalizedStatus));
      return issueType ? mapped.filter((i) => i.issueType === issueType) : mapped;
    } catch {
      return [];
    }
  }

  /**
   * Fetch complete IPO details including lot size, timeline, and subscription breakdown
   */
  static async getIpoDetails(ipoId: string): Promise<Partial<UnifiedIPO> | null> {
    const cacheKey = `upstox:ipo:${ipoId}`;

    // 1. Check in-memory cache
    const memCached = this.memoryCache.get(cacheKey);
    if (memCached && Date.now() < memCached.expiry) {
      return memCached.data;
    }

    // 2. Check Redis cache
    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Redis optional
    }

    const token = this.getAccessToken();

    if (!token) {
      return await this.getFallbackIpoDetails(ipoId);
    }

    try {
      const url = `${this.baseUrl}/ipos/${encodeURIComponent(ipoId)}`;
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(process.env.NODE_ENV === 'test' ? 1000 : 3000),
      });

      if (!res.ok) {
        console.warn(`[UpstoxIpoService] HTTP ${res.status} on details for '${ipoId}'. Using live fallback.`);
        return await this.getFallbackIpoDetails(ipoId);
      }

      const json = await res.json();
      const item: UpstoxIpoItem = json.data;

      if (!item) {
        return await this.getFallbackIpoDetails(ipoId);
      }

      const unified = this.mapUpstoxItemToUnified(item, this.normalizeStatus(item.status));

      // Cache details
      try {
        const redis = getRedisClient();
        await redis.set(cacheKey, JSON.stringify(unified), 'EX', this.CACHE_TTL_SECONDS);
      } catch {
        // Redis optional
      }
      this.memoryCache.set(cacheKey, {
        data: unified,
        expiry: Date.now() + this.CACHE_TTL_SECONDS * 1000,
      });

      return unified;
    } catch (err: any) {
      console.warn(`[UpstoxIpoService] Error fetching details for '${ipoId}': ${err.message}`);
      return await this.getFallbackIpoDetails(ipoId);
    }
  }

  /**
   * Map raw Upstox IPO item to UnifiedIPO interface
   */
  private static mapUpstoxItemToUnified(
    item: UpstoxIpoItem,
    status: 'upcoming' | 'open' | 'closed' | 'listed'
  ): Partial<UnifiedIPO> {
    const rawIssueType = (item.issue_type || '').toLowerCase();
    const issueType: IssueType = rawIssueType.includes('sme') ? 'sme' : 'regular';

    const minPrice = Number(item.minimum_price || item.cut_off_price || 0);
    const maxPrice = Number(item.maximum_price || item.cut_off_price || minPrice || 100);

    const subscriptionTotal = item.total_subscription !== undefined && item.total_subscription !== null
      ? Number(item.total_subscription)
      : undefined;

    // Extract category subscriptions if present in investors
    let subscriptionRetail: number | undefined;
    let subscriptionHni: number | undefined;
    let subscriptionQib: number | undefined;

    if (Array.isArray(item.investors)) {
      item.investors.forEach((inv) => {
        const cat = (inv.category || '').toUpperCase();
        const desc = (inv.description || '').toUpperCase();
        const rate = Number(inv.subscription_rate || 0);
        if (cat.includes('RETAIL') || cat.includes('INDIVIDUAL') || desc.includes('RETAIL') || desc.includes('INDIVIDUAL')) {
          subscriptionRetail = rate;
        }
        if (cat.includes('HNI') || cat.includes('NII') || desc.includes('HNI') || desc.includes('NON-INSTITUTIONAL') || desc.includes('NII')) {
          subscriptionHni = rate;
        }
        if (cat.includes('QIB') || cat.includes('INSTITUTIONAL') || desc.includes('QUALIFIED') || desc.includes('QIB')) {
          subscriptionQib = rate;
        }
      });
    }

    // Default lot sizes based on issue type if not provided
    const lotSize = Number(item.lot_size || (issueType === 'sme' ? 1200 : Math.round(15000 / (maxPrice || 100))));

    // Instrument key for listed stocks
    const instrumentKey = item.isin ? `NSE_EQ|${item.isin}` : `NSE_EQ|${item.symbol}`;

    // Format readable listing date if available
    let formattedListingDate = item.timeline?.listing_date || (item as any).listing_date || undefined;
    if (formattedListingDate && /^\d{4}-\d{2}-\d{2}/.test(formattedListingDate)) {
      const d = new Date(formattedListingDate);
      if (!isNaN(d.getTime())) {
        formattedListingDate = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    } else if (!formattedListingDate && status === 'listed' && (item.bidding_end_date || item.timeline?.application_end_date)) {
      const dateSource = item.bidding_end_date || item.timeline?.application_end_date;
      const d = new Date(dateSource!);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + 4);
        formattedListingDate = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }

    const cutOffPrice = item.cut_off_price ? Number(item.cut_off_price) : maxPrice;
    const listingPrice = item.listing_price ? Number(item.listing_price) : undefined;
    const issuePrice = cutOffPrice || maxPrice || minPrice;

    return {
      id: item.id || (item.symbol ? item.symbol.toLowerCase() : 'ipo-unknown'),
      symbol: (item.symbol || '').toUpperCase(),
      companyName: item.name || item.symbol || 'Unknown Company',
      issueType,
      status,
      priceBandMin: minPrice,
      priceBandMax: maxPrice,
      lotSize,
      openDate: item.timeline?.application_start_date || item.bidding_start_date || '',
      closeDate: item.timeline?.application_end_date || item.bidding_end_date || '',
      listingDate: formattedListingDate,
      issueSizeInCrores: item.issue_size ? Number(item.issue_size) : undefined,
      subscriptionTotal,
      subscriptionRetail,
      subscriptionHni,
      subscriptionQib,
      registrar: item.registrar_info?.name || undefined,
      instrumentKey,
      isin: item.isin,
      cutOffPrice,
      listingPrice,
      issuePrice,
    };
  }

  /**
   * Fetch real-time market quotes (LTP, net change, volume, OHLC) from Upstox API v2
   */
  static async getMarketQuotes(instrumentKeys: string[]): Promise<Record<string, {
    last_price: number;
    net_change: number;
    day_change_percent: number;
    volume: number;
    open: number;
    high: number;
    low: number;
    close: number;
    symbol: string;
  }>> {
    const token = this.getAccessToken();
    if (!token || instrumentKeys.length === 0) return {};

    const quotes: Record<string, any> = {};
    const uniqueKeys = Array.from(new Set(instrumentKeys)).filter(Boolean);

    // Chunk in batches of 100
    const chunkSize = 100;
    for (let i = 0; i < uniqueKeys.length; i += chunkSize) {
      const batch = uniqueKeys.slice(i, i + chunkSize);
      try {
        const url = `${this.baseUrl}/market-quote/quotes?instrument_key=${encodeURIComponent(batch.join(','))}`;
        const res = await fetch(url, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          signal: AbortSignal.timeout(process.env.NODE_ENV === 'test' ? 1000 : 4000),
        });

        if (!res.ok) continue;
        const json = await res.json();
        const data = json.data || {};

        for (const [key, q] of Object.entries<any>(data)) {
          if (!q) continue;
          const ltp = Number(q.last_price || q.ohlc?.close || 0);
          const netChange = Number(q.net_change ?? (ltp - (q.ohlc?.close || ltp)));
          const prevClose = Number(q.ohlc?.close || (ltp - netChange) || ltp);
          const changePercent = prevClose > 0 ? Number(((netChange / prevClose) * 100).toFixed(2)) : 0;
          const symbol = (q.symbol || key.split(':').pop() || '').toUpperCase();

          const parsed = {
            last_price: ltp,
            net_change: netChange,
            day_change_percent: changePercent,
            volume: Number(q.volume || 0),
            open: Number(q.ohlc?.open || ltp),
            high: Number(q.ohlc?.high || ltp),
            low: Number(q.ohlc?.low || ltp),
            close: prevClose,
            symbol,
          };

          quotes[key] = parsed;
          quotes[key.replace(':', '|')] = parsed;
          if (symbol) {
            quotes[symbol] = parsed;
          }
          if (q.instrument_token) {
            quotes[q.instrument_token] = parsed;
            quotes[q.instrument_token.replace('|', ':')] = parsed;
          }
        }
      } catch (err: any) {
        console.warn('[UpstoxIpoService] Market quotes batch notice:', err.message);
      }
    }

    return quotes;
  }

  /**
   * Normalize input status to standard lowercase status
   */
  private static normalizeStatus(status: string | IpoStatus): 'upcoming' | 'open' | 'closed' | 'listed' {
    const s = String(status).toLowerCase();
    if (s.includes('upcom') || s.includes('forthcom')) return 'upcoming';
    if (s.includes('open') || s.includes('active')) return 'open';
    if (s.includes('close')) return 'closed';
    if (s.includes('list')) return 'listed';
    return 'open';
  }

  /**
   * Resilient LIVE market fallback from NSE India and live web tracker (Zero offline mock data)
   */
  private static async getFallbackIpos(
    status: 'upcoming' | 'open' | 'closed' | 'listed',
    issueType?: IssueType
  ): Promise<Partial<UnifiedIPO>[]> {
    try {
      const { fetchLiveNseIpos } = await import('@/services/nseIpoService');
      const liveList = await fetchLiveNseIpos();

      const mapped: Partial<UnifiedIPO>[] = liveList
        .filter((item) => {
          const isListed = Boolean(item.isListed || item.status === 'Listed');
          if (status === 'listed') {
            return isListed;
          }
          if (isListed) return false;
          const isClosed = item.status === 'Closed' || item.remainingTime === 'Bidding Closed';
          if (isClosed) return status === 'closed';
          const itemStatus = item.status === 'Active' ? 'open' : 'upcoming';
          return itemStatus === status;
        })
        .map((item) => {
          const priceMatch = (item.priceBand || item.issuePrice || '100').match(/\d+(?:\.\d+)?/g) || ['100'];
          const minPrice = parseFloat(priceMatch[0]) || 100;
          const maxPrice = parseFloat(priceMatch[priceMatch.length - 1]) || minPrice;
          const currentIssueType: IssueType = item.series === 'SME' ? 'sme' : 'regular';
          const lotSize = typeof item.lotSize === 'number' ? item.lotSize : (item.lotSize ? parseInt(item.lotSize, 10) : (currentIssueType === 'sme' ? 1200 : 14));

          return {
            id: `${item.symbol.toLowerCase()}-ipo`,
            symbol: item.symbol.toUpperCase(),
            companyName: item.companyName,
            issueType: currentIssueType,
            status,
            priceBandMin: minPrice,
            priceBandMax: maxPrice,
            lotSize,
            openDate: item.issueStartDate,
            closeDate: item.issueEndDate,
            listingDate: item.status === 'Closed' || item.isListed ? 'Recent Listing' : undefined,
            issueSizeInCrores: item.issueSize ? parseFloat(item.issueSize) : undefined,
            subscriptionTotal: parseFloat(item.noOfTime || '0') || undefined,
            registrar: item.registrarName,
            instrumentKey: `NSE_EQ|${item.symbol.toUpperCase()}`,
          };
        });

      if (mapped.length === 0) {
        if (status === 'listed') {
          const { LISTED_IPOS_REGISTRY } = await import('@/services/listedIpoService');
          const listedMapped: Partial<UnifiedIPO>[] = LISTED_IPOS_REGISTRY.map((l) => ({
            id: `${l.symbol.toLowerCase()}-ipo`,
            symbol: l.symbol.toUpperCase(),
            companyName: l.companyName,
            issueType: l.series === 'SME' ? 'sme' : 'regular',
            status: 'listed',
            priceBandMin: l.issuePrice,
            priceBandMax: l.issuePrice,
            lotSize: l.series === 'SME' ? 1200 : 14,
            openDate: 'Past Issue',
            closeDate: 'Past Issue',
            listingDate: l.listingDate,
            registrar: l.allotmentRegistrar,
            instrumentKey: `NSE_EQ|${l.symbol.toUpperCase()}`,
          }));
          return issueType ? listedMapped.filter((i) => i.issueType === issueType) : listedMapped;
        } else {
          const { MARKET_IPO_REGISTRY, isListingDatePast, isBiddingClosed, isBiddingStarted } = await import('@/services/nseIpoService');
          const regMapped: Partial<UnifiedIPO>[] = MARKET_IPO_REGISTRY.map((m) => {
            const isListed = isListingDatePast(m.listingDate);
            const isClosed = isBiddingClosed(m.closeDate);
            const itemStatus: 'upcoming' | 'open' | 'closed' | 'listed' =
              isListed ? 'listed' : isClosed ? 'closed' : isBiddingStarted(m.openDate) ? 'open' : 'upcoming';
            return {
              id: `${m.symbol.toLowerCase()}-ipo`,
              symbol: m.symbol.toUpperCase(),
              companyName: m.companyName,
              issueType: (m.series === 'SME' ? 'sme' : 'regular') as IssueType,
              status: itemStatus,
              priceBandMin: m.priceLow,
              priceBandMax: m.priceHigh,
              lotSize: m.lotSize,
              openDate: m.openDate,
              closeDate: m.closeDate,
              listingDate: m.listingDate,
              issueSizeInCrores: m.issueSizeCr,
              subscriptionTotal: m.currentSubscription,
              subscriptionRetail: m.retailSubscription,
              subscriptionHni: m.niiSubscription,
              subscriptionQib: m.qibSubscription,
              registrar: m.registrar,
              instrumentKey: `NSE_EQ|${m.symbol.toUpperCase()}`,
            };
          }).filter((i) => i.status === status);
          if (regMapped.length > 0) {
            return issueType ? regMapped.filter((i) => i.issueType === issueType) : regMapped;
          }
        }
      }

      if (issueType) {
        return mapped.filter((i) => i.issueType === issueType);
      }
      return mapped;
    } catch (err: any) {
      console.warn('[UpstoxIpoService] Live fallback notice:', err.message);
      return [];
    }
  }

  private static async getFallbackIpoDetails(ipoId: string): Promise<Partial<UnifiedIPO> | null> {
    const clean = ipoId.replace(/-ipo$/i, '').toUpperCase().trim();
    try {
      const { fetchLiveIpoDetail } = await import('@/services/nseIpoService');
      const liveDetail = await fetchLiveIpoDetail(clean);
      if (liveDetail) {
        const prices = (liveDetail.issuePrice || '100').match(/\d+(?:\.\d+)?/g) || ['100'];
        const priceMax = parseFloat(prices[prices.length - 1]) || 100;
        const priceMin = parseFloat(prices[0]) || priceMax;
        const currentIssueType: IssueType = liveDetail.series === 'SME' ? 'sme' : 'regular';
        return {
          id: `${liveDetail.symbol.toLowerCase()}-ipo`,
          symbol: liveDetail.symbol.toUpperCase(),
          companyName: liveDetail.companyName,
          issueType: currentIssueType,
          status: liveDetail.status === 'Active' ? 'open' : liveDetail.status === 'Forthcoming' ? 'upcoming' : 'closed',
          priceBandMin: priceMin,
          priceBandMax: priceMax,
          lotSize: liveDetail.lotSize || (currentIssueType === 'sme' ? 1200 : 14),
          openDate: liveDetail.issueStartDate,
          closeDate: liveDetail.issueEndDate,
          issueSizeInCrores: liveDetail.issueSizeCr,
          subscriptionTotal: parseFloat(liveDetail.noOfTimesIssueSubscribed || '0') || undefined,
          registrar: liveDetail.registrarName,
          instrumentKey: `NSE_EQ|${liveDetail.symbol.toUpperCase()}`,
        };
      }
    } catch {
      // ignore
    }

    // Try finding in listed registry
    try {
      const { LISTED_IPOS_REGISTRY } = await import('@/services/listedIpoService');
      const listed = LISTED_IPOS_REGISTRY.find(
        (l) => l.symbol.toUpperCase() === clean || ipoId.toLowerCase().includes(l.symbol.toLowerCase())
      );
      if (listed) {
        return {
          id: `${listed.symbol.toLowerCase()}-ipo`,
          symbol: listed.symbol,
          companyName: listed.companyName,
          issueType: listed.series === 'SME' ? 'sme' : 'regular',
          status: 'listed',
          priceBandMin: listed.issuePrice,
          priceBandMax: listed.issuePrice,
          lotSize: listed.series === 'SME' ? 1200 : 35,
          listingDate: listed.listingDate,
          registrar: listed.allotmentRegistrar,
          instrumentKey: `NSE_EQ|${listed.symbol}`,
        };
      }
    } catch {
      // ignore
    }

    return null;
  }
}
