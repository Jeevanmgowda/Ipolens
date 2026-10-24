/**
 * IPOFetch Service: Multi-exchange (NSE + BSE) and Grey Market Premium pipeline prototype.
 *
 * COMPLIANCE & ARCHITECTURAL NOTICE:
 * This module is maintained strictly as an offline research and testing adapter.
 * For official production live market telemetry and listing data, IPOLENS uses authorized broker
 * APIs (Upstox Live Pipeline via /api/live-market and /api/ipos/upstox) and authenticated feeds.
 * Scraped endpoints must never be presented as official live exchange data.
 */

import { LiveIpoSummary, LiveIpoDetail, IpoSeries, IpoStatus, UnifiedIPO } from '@/types/ipo';
import { getRedisClient } from '@/lib/redis';
import { getRegistrarInfo, calculateRemainingTime, cleanPriceText, findMarketMetadata } from './nseIpoService';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export interface MergedIpoRecord {
  symbol: string;
  companyName: string;
  normalizedName: string;
  platform: 'Mainboard' | 'SME';
  series: IpoSeries;
  exchanges: ('NSE' | 'BSE')[];
  status: IpoStatus;
  openDate: string;
  closeDate: string;
  listingDate?: string;
  priceBand: { min: number; max: number };
  priceBandStr: string;
  lotSize: number;
  faceValue?: number;
  issueSizeStr?: string;
  issueSizeCr?: number;
  gmp?: { value: number | null; percent: number | null };
  subscriptionTimes?: string;
  retailSubscription?: number;
  niiSubscription?: number;
  qibSubscription?: number;
  registrarName: string;
  registrarUrl: string;
  rawNse?: any;
  rawBse?: any;
  rawGmp?: any;
}

// Memory cache entry with timestamp
interface CacheWrapper<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL for fast, non-rate-limited responses
let memoryCache: CacheWrapper<MergedIpoRecord[]> | null = null;
let nseCookieCache: { cookie: string; timestamp: number } | null = null;

export class IpoFetchService {
  private static NSE_BASE = 'https://www.nseindia.com';
  private static NSE_WARMUP = '/market-data/all-upcoming-issues-ipo';
  private static BSE_BASE = 'https://api.bseindia.com/BseIndiaAPI/api';
  private static INVESTORGAIN_BASE = 'https://webnodejs.investorgain.com/cloud/v2/report/data-read/331';

  /**
   * HTML tag and entity stripper
   */
  static stripHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#8377;/g, '₹')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalizes company names to a common key (stripping legal suffixes and punctuation)
   * Example: "Tonbo Imaging India Limited" -> "tonbo imaging india"
   */
  static normalizeName(name: string): string {
    if (!name) return '';
    let text = this.stripHtml(name).toLowerCase();
    text = text.replace(/\b(limited|ltd|private|pvt|iv|inc|llp)\b\.?/gi, ' ');
    text = text.replace(/[^a-z0-9]+/g, ' ');
    return text.trim().replace(/\s+/g, ' ');
  }

  /**
   * Derives a stock ticker symbol from company name or existing registry
   */
  static deriveTicker(name: string): string {
    const meta = findMarketMetadata(name);
    if (meta) return meta.symbol;

    const clean = name.replace(/Limited|Ltd\.?|India|Private|Pvt\.?|Holding|Holdings|Solutions|Services/gi, '').trim();
    const words = clean.split(/[\s\-_]+/).filter(Boolean);
    if (words.length === 0) return 'IPO';
    if (words.length === 1) return words[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
    if (words.length === 2) {
      const w1 = words[0].replace(/[^a-zA-Z0-9]/g, '');
      const w2 = words[1].replace(/[^a-zA-Z0-9]/g, '');
      return (w1.slice(0, 6) + w2.slice(0, 4)).toUpperCase();
    }
    const initials = words.map((w) => w[0]).join('').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return (words[0].replace(/[^a-zA-Z0-9]/g, '').slice(0, 5) + initials.slice(1, 4)).toUpperCase();
  }

  /**
   * Safe fetch with timeout and headers
   */
  private static async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 7000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 1. NSE Cookie Handshake & Endpoint Fetching
   */
  static async getNseCookies(): Promise<string> {
    const now = Date.now();
    if (nseCookieCache && now - nseCookieCache.timestamp < 10 * 60 * 1000) {
      return nseCookieCache.cookie;
    }

    try {
      const res = await this.fetchWithTimeout(`${this.NSE_BASE}${this.NSE_WARMUP}`, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      const rawCookies = (res.headers as any).getSetCookie
        ? (res.headers as any).getSetCookie()
        : [res.headers.get('set-cookie')];

      const cookieStr = rawCookies
        .map((c: string | null) => (c ? c.split(';')[0] : ''))
        .filter(Boolean)
        .join('; ');

      if (cookieStr) {
        nseCookieCache = { cookie: cookieStr, timestamp: now };
      }
      return cookieStr;
    } catch (err: any) {
      return nseCookieCache?.cookie || '';
    }
  }

  static async fetchNseData(): Promise<{ current: any[]; upcoming: any[]; past: any[] }> {
    try {
      const cookie = await this.getNseCookies();
      const headers = {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'application/json, text/plain, */*',
        'Referer': `${this.NSE_BASE}${this.NSE_WARMUP}`,
        ...(cookie ? { Cookie: cookie } : {}),
      };

      const [curRes, upRes] = await Promise.all([
        this.fetchWithTimeout(`${this.NSE_BASE}/api/ipo-current-issue`, { headers }).catch(() => null),
        this.fetchWithTimeout(`${this.NSE_BASE}/api/all-upcoming-issues?category=ipo`, { headers }).catch(() => null),
      ]);

      const current = curRes && curRes.ok ? await curRes.json().catch(() => []) : [];
      const upcoming = upRes && upRes.ok ? await upRes.json().catch(() => []) : [];

      return {
        current: Array.isArray(current) ? current : [],
        upcoming: Array.isArray(upcoming) ? upcoming : [],
        past: [],
      };
    } catch {
      return { current: [], upcoming: [], past: [] };
    }
  }

  /**
   * 2. BSE India Fetching (No cookies needed, uses Referer)
   */
  static async fetchBseData(): Promise<any[]> {
    try {
      const res = await this.fetchWithTimeout(
        `${this.BSE_BASE}/GetPublicIssue_par_updated/w?flag=1&status=&exchange=&ir_flag=IPO`,
        {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json',
            'Referer': 'https://www.bseindia.com/',
          },
        }
      );
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json?.Table) ? json.Table : [];
    } catch {
      return [];
    }
  }

  /**
   * 3. InvestorGain Live GMP & Subscription Fetching
   */
  static async fetchInvestorGainData(): Promise<any[]> {
    try {
      const today = new Date();
      const month = today.getUTCMonth() + 1;
      const year = today.getUTCFullYear();
      const startYear = month >= 4 ? year : year - 1;
      const fy = `${startYear}-${String(startYear + 1).slice(-2)}`;

      const url = `${this.INVESTORGAIN_BASE}/1/${month}/${year}/${fy}/0/all?search=`;
      const res = await this.fetchWithTimeout(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
          'Referer': 'https://www.investorgain.com/report/live-ipo-gmp/331/ipo/',
          'Origin': 'https://www.investorgain.com',
        },
      });

      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json?.reportTableData) ? json.reportTableData : [];
    } catch {
      return [];
    }
  }

  /**
   * Helper to parse price band string: "665.00 - 700.00" or "₹693"
   */
  static parsePriceBand(text: string | null | undefined): { min: number; max: number } {
    if (!text) return { min: 100, max: 100 };
    const clean = text.replace(/Rs\./gi, '').replace(/₹/g, '').replace(/,/g, '');
    const numbers = clean.match(/(\d+(?:\.\d+)?)/g);
    if (!numbers || numbers.length === 0) return { min: 100, max: 100 };
    if (numbers.length === 1) {
      const val = parseFloat(numbers[0]) || 100;
      return { min: val, max: val };
    }
    const min = parseFloat(numbers[0]) || 100;
    const max = parseFloat(numbers[numbers.length - 1]) || min;
    return { min, max };
  }

  /**
   * Helper to parse GMP HTML fragment: '&#8377;<b>95</b> (13.71%)'
   */
  static parseGmpField(raw: string | null | undefined): { value: number | null; percent: number | null } {
    if (!raw) return { value: null, percent: null };
    const valMatch = raw.match(/₹\s*<b>(.*?)<\/b>/i) || raw.match(/&#8377;\s*<b>(.*?)<\/b>/i);
    const pctMatch = raw.match(/\(([^%)]*)%?\)/);

    let value: number | null = null;
    let percent: number | null = null;

    if (valMatch && valMatch[1]) {
      const vStr = valMatch[1].replace(/[^\d.-]/g, '');
      if (vStr && !isNaN(Number(vStr))) value = parseFloat(vStr);
    }
    if (pctMatch && pctMatch[1]) {
      const pStr = pctMatch[1].replace(/[^\d.-]/g, '');
      if (pStr && !isNaN(Number(pStr))) percent = parseFloat(pStr);
    }

    if (value === null) {
      // Fallback plain regex on cleaned text
      const clean = this.stripHtml(raw);
      const m = clean.match(/₹?\s*(\d+(?:\.\d+)?)\s*\(([\d.]+)/);
      if (m) {
        value = parseFloat(m[1]);
        percent = parseFloat(m[2]);
      }
    }

    return { value, percent };
  }

  /**
   * Cross-Exchange Merger Engine:
   * Merges NSE, BSE, and InvestorGain live data records by company name key.
   */
  static async getMergedIpos(forceRefresh = false): Promise<MergedIpoRecord[]> {
    const now = Date.now();
    if (!forceRefresh && memoryCache && now - memoryCache.timestamp < CACHE_TTL_MS) {
      return memoryCache.data;
    }

    // Try Redis cache if available
    try {
      const redis = getRedisClient();
      const cached = await redis.get('ipofetch:merged');
      if (cached && !forceRefresh) {
        const parsed = JSON.parse(cached);
        memoryCache = { data: parsed, timestamp: now };
        return parsed;
      }
    } catch {
      // Redis optional
    }

    // Fetch all three pipelines concurrently
    const [nseData, bseIssues, igRows] = await Promise.all([
      this.fetchNseData(),
      this.fetchBseData(),
      this.fetchInvestorGainData(),
    ]);

    const recordsMap = new Map<string, MergedIpoRecord>();

    const getOrCreate = (name: string): MergedIpoRecord | undefined => {
      const key = this.normalizeName(name);
      if (!key) return undefined;
      if (!recordsMap.has(key)) {
        const registrar = getRegistrarInfo('', name);
        const symbol = this.deriveTicker(name);
        recordsMap.set(key, {
          symbol,
          companyName: name.trim(),
          normalizedName: key,
          platform: 'Mainboard',
          series: 'EQ',
          exchanges: [],
          status: 'Forthcoming',
          openDate: '',
          closeDate: '',
          listingDate: undefined,
          priceBand: { min: 100, max: 100 },
          priceBandStr: 'TBD',
          lotSize: 14,
          registrarName: registrar.name,
          registrarUrl: registrar.url,
        });
      }
      return recordsMap.get(key)!;
    };

    // 1. Ingest BSE Issues
    for (const bse of bseIssues) {
      const name = bse.Scrip_Name || bse.short_name;
      if (!name) continue;
      const rec = getOrCreate(name);
      if (!rec) continue;

      if (!rec.exchanges.includes('BSE')) rec.exchanges.push('BSE');
      rec.rawBse = bse;
      const isSme = bse.eXCHANGE_PLATFORM === 'SME';
      if (isSme) {
        rec.platform = 'SME';
        rec.series = 'SME';
      }

      if (bse.Start_Dt) rec.openDate = bse.Start_Dt.split('T')[0];
      if (bse.End_Dt) rec.closeDate = bse.End_Dt.split('T')[0];
      if (bse.Face_Val) rec.faceValue = bse.Face_Val;
      if (bse.Price_Band) {
        rec.priceBand = this.parsePriceBand(bse.Price_Band);
        rec.priceBandStr = cleanPriceText(bse.Price_Band);
      }
      if (bse.Status === 'L') {
        rec.status = 'Active';
      } else if (bse.Status === 'F') {
        rec.status = 'Forthcoming';
      }
    }

    // 2. Ingest NSE Upcoming Issues
    for (const row of nseData.upcoming) {
      const name = row.companyName || row.company;
      if (!name) continue;
      const rec = getOrCreate(name);
      if (!rec) continue;

      if (!rec.exchanges.includes('NSE')) rec.exchanges.push('NSE');
      rec.rawNse = row;
      if (row.symbol) rec.symbol = row.symbol.toUpperCase();

      if (row.series === 'SME' || (row.series && row.series.includes('SME'))) {
        rec.platform = 'SME';
        rec.series = 'SME';
      }

      if (row.issueStartDate || row.ipoStartDate) {
        rec.openDate = rec.openDate || (row.issueStartDate || row.ipoStartDate);
      }
      if (row.issueEndDate || row.ipoEndDate) {
        rec.closeDate = rec.closeDate || (row.issueEndDate || row.ipoEndDate);
      }
      const rawPrice = row.issuePrice || row.priceRange;
      if (rawPrice) {
        rec.priceBand = this.parsePriceBand(rawPrice);
        rec.priceBandStr = cleanPriceText(rawPrice);
      }
      rec.status = 'Forthcoming';
    }

    // 3. Ingest NSE Current (Live) Issues
    for (const row of nseData.current) {
      const name = row.companyName;
      if (!name) continue;
      const rec = getOrCreate(name);
      if (!rec) continue;

      if (!rec.exchanges.includes('NSE')) rec.exchanges.push('NSE');
      rec.rawNse = row;
      if (row.symbol) rec.symbol = row.symbol.toUpperCase();
      rec.status = 'Active';

      if (row.series === 'SME' || (row.series && row.series.includes('SME'))) {
        rec.platform = 'SME';
        rec.series = 'SME';
      }
      if (row.issueStartDate) rec.openDate = row.issueStartDate;
      if (row.issueEndDate) rec.closeDate = row.issueEndDate;
      if (row.issuePrice) {
        rec.priceBand = this.parsePriceBand(row.issuePrice);
        rec.priceBandStr = cleanPriceText(row.issuePrice);
      }
    }

    // 4. Merge InvestorGain Live GMP & Subscription Data
    for (const row of igRows) {
      const nameMatch = (row.Name || '').match(/>([^<]+)<\/a>/);
      const rawName = nameMatch ? nameMatch[1].trim() : this.stripHtml(row.Name || '');
      if (!rawName) continue;

      const key = this.normalizeName(rawName);
      let rec = recordsMap.get(key);

      // Best effort prefix match if exact normalized key not found
      if (!rec) {
        for (const [k, existing] of recordsMap.entries()) {
          if (k.startsWith(key) || key.startsWith(k)) {
            rec = existing;
            break;
          }
        }
      }

      // If not yet in exchange data, create record from InvestorGain (e.g. newly announced draft filings)
      if (!rec) {
        rec = getOrCreate(rawName);
      }
      if (!rec) continue;

      rec.rawGmp = row;
      const gmpParsed = this.parseGmpField(row.GMP);
      rec.gmp = gmpParsed;

      const subStr = this.stripHtml(row.Sub || '');
      if (subStr && subStr !== '-') {
        rec.subscriptionTimes = subStr.endsWith('x') ? subStr : `${subStr}x`;
      }

      if (row['~IPO_Category'] === 'SME') {
        rec.platform = 'SME';
        rec.series = 'SME';
      }

      if (row['~Srt_Open']) rec.openDate = rec.openDate || row['~Srt_Open'];
      if (row['~Srt_Close']) rec.closeDate = rec.closeDate || row['~Srt_Close'];
      if (row['~Str_Listing']) rec.listingDate = row['~Str_Listing'];

      const igLot = this.stripHtml(row.Lot || '');
      if (igLot && !isNaN(Number(igLot))) {
        rec.lotSize = parseInt(igLot, 10);
      }

      const igSize = this.stripHtml(row['IPO Size'] || '');
      if (igSize && igSize !== '-') {
        rec.issueSizeStr = igSize;
        const sizeCrMatch = igSize.match(/(\d+(?:\.\d+)?)/);
        if (sizeCrMatch) rec.issueSizeCr = parseFloat(sizeCrMatch[1]);
      }

      const igPrice = this.stripHtml(row['Price (₹)'] || '');
      if (igPrice && igPrice !== '-') {
        rec.priceBand = this.parsePriceBand(igPrice);
        rec.priceBandStr = cleanPriceText(igPrice);
      }

      // Status mapping from IG
      const igStatus = row['~ipo_status1'];
      if (igStatus === 'O') rec.status = 'Active';
      else if (igStatus === 'U' && rec.status !== 'Active') rec.status = 'Forthcoming';
      else if (igStatus === 'C' && rec.status !== 'Active') rec.status = 'Closed';
    }

    const mergedList = Array.from(recordsMap.values());

    // Fill in default lotSize and minInvestment if missing
    for (const item of mergedList) {
      if (!item.lotSize || item.lotSize <= 0) {
        item.lotSize = item.series === 'SME' ? 1200 : 14;
      }
    }

    // Cache results
    memoryCache = { data: mergedList, timestamp: now };
    try {
      const redis = getRedisClient();
      await redis.set('ipofetch:merged', JSON.stringify(mergedList), 'EX', 60);
    } catch {
      // Redis optional
    }

    return mergedList;
  }

  /**
   * Adapts MergedIpoRecord to IPOLENS LiveIpoSummary
   */
  static toLiveIpoSummary(rec: MergedIpoRecord): LiveIpoSummary {
    const minInv = rec.priceBand.max * rec.lotSize;
    const subNum = rec.subscriptionTimes ? parseFloat(rec.subscriptionTimes.replace('x', '')) : undefined;

    return {
      symbol: rec.symbol,
      companyName: rec.companyName,
      series: rec.series,
      status: rec.status,
      issueStartDate: rec.openDate || 'TBD',
      issueEndDate: rec.closeDate || 'TBD',
      issuePrice: rec.priceBandStr,
      priceBand: rec.priceBandStr,
      priceLow: rec.priceBand.min,
      priceHigh: rec.priceBand.max,
      lotSize: rec.lotSize,
      minInvestment: minInv,
      issueSize: rec.issueSizeStr || (rec.issueSizeCr ? `₹${rec.issueSizeCr} Cr` : 'TBD'),
      issueSizeCr: rec.issueSizeCr,
      noOfTime: rec.subscriptionTimes,
      isBse: rec.exchanges.includes('BSE') ? 'Y' : 'N',
      gmpEstimate: rec.gmp?.value || 0,
      gmpPercent: rec.gmp?.percent || 0,
      retailSubscription: rec.retailSubscription || subNum,
      niiSubscription: rec.niiSubscription,
      qibSubscription: rec.qibSubscription,
      remainingTime: calculateRemainingTime(rec.closeDate),
      registrarName: rec.registrarName,
      registrarUrl: rec.registrarUrl,
      isListed: rec.status === 'Listed',
    };
  }

  /**
   * Adapts MergedIpoRecord to IPOLENS UnifiedIPO
   */
  static toUnifiedIpo(rec: MergedIpoRecord): UnifiedIPO {
    const gmpVal = rec.gmp?.value || 0;
    const maxPrice = rec.priceBand.max || 100;
    const gainPct = maxPrice > 0 ? Number(((gmpVal / maxPrice) * 100).toFixed(2)) : 0;
    const subNum = rec.subscriptionTimes ? parseFloat(rec.subscriptionTimes.replace('x', '')) : undefined;

    const unifiedStatus: 'upcoming' | 'open' | 'closed' | 'listed' =
      rec.status === 'Active'
        ? 'open'
        : rec.status === 'Forthcoming'
        ? 'upcoming'
        : rec.status === 'Listed'
        ? 'listed'
        : 'closed';

    return {
      id: `${rec.symbol.toLowerCase()}-ipo`,
      symbol: rec.symbol,
      companyName: rec.companyName,
      issueType: rec.platform === 'SME' ? 'sme' : 'regular',
      status: unifiedStatus,
      priceBandMin: rec.priceBand.min,
      priceBandMax: rec.priceBand.max,
      lotSize: rec.lotSize,
      openDate: rec.openDate,
      closeDate: rec.closeDate,
      listingDate: rec.listingDate,
      issueSizeInCrores: rec.issueSizeCr,
      subscriptionTotal: subNum,
      registrar: rec.registrarName,
      instrumentKey: `NSE_EQ|${rec.symbol}`,
      gmp: gmpVal,
      expectedListingGainPct: gainPct,
    };
  }
}
