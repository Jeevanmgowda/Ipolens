import { getRedisClient } from '@/lib/redis';
import { isDatabaseConfigured } from '@/db';
import { IpoRepository, type IpoDbView, type IpoUpsert } from '@/lib/repositories/ipo.repository';
import { BROWSER_UA, toNumber } from '@/lib/ingestion/http';
import { resolveRegistrarSlug } from '@/lib/registrars';

const NSE_BASE = 'https://www.nseindia.com';
const CACHE_KEY_PREFIX = 'ipo:live:v1:';
const CACHE_TTL_SECONDS = 300; // 5 minutes
const NSE_TIMEOUT_MS = 8000;

export interface LiveIpoRecord {
  symbol: string;
  companyName: string;
  status: 'OPEN' | 'UPCOMING' | 'CLOSED' | 'LISTED';
  issueType: 'EQ' | 'SME';
  priceBandMin: number | null;
  priceBandMax: number | null;
  lotSize: number | null;
  issueSizeCr: number | null;
  openDate: string | null;
  closeDate: string | null;
  allotmentDate: string | null;
  listingDate: string | null;
  registrar: string | null;
  qibMultiple: number | null;
  niiMultiple: number | null;
  riiMultiple: number | null;
  totalMultiple: number | null;
  gmpPrice: number | null;
  listingPrice: number | null;
  currentLtp: number | null;
  source: string;
}

export interface LiveIpoListResult {
  items: LiveIpoRecord[];
  stale: boolean;
  source: 'nse' | 'cache' | 'database';
  fetchedAt: string;
}

const memoryFallback = new Map<string, { value: string; expiresAt: number }>();

async function cacheGet(key: string): Promise<string | null> {
  try {
    const val = await getRedisClient().get(key);
    if (val) return val;
  } catch {
    // Fall through to local TTL Map
  }
  const hit = memoryFallback.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memoryFallback.delete(key);
    return null;
  }
  return hit.value;
}

async function cacheSet(key: string, value: string, ttlSec = CACHE_TTL_SECONDS): Promise<void> {
  memoryFallback.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  try {
    await getRedisClient().set(key, value, 'EX', ttlSec);
  } catch {
    // In-memory TTL Map remains active
  }
}

function parseNseDate(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || s === '-' || s === 'TBD') return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(`${s} UTC`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parsePriceBand(raw: unknown): { min: number | null; max: number | null } {
  if (!raw) return { min: null, max: null };
  const nums = String(raw)
    .replace(/,/g, '')
    .match(/\d+(?:\.\d+)?/g)
    ?.map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!nums || nums.length === 0) return { min: null, max: null };
  return { min: nums[0], max: nums[nums.length - 1] };
}

async function getNseSessionCookie(): Promise<string> {
  const res = await fetch(NSE_BASE, {
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(NSE_TIMEOUT_MS),
    cache: 'no-store',
  });
  const setCookies =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (res.headers.get('set-cookie') || '').split(/,(?=\s*[^;]+=)/);
  return setCookies
    .map((c) => c.split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ');
}

async function fetchNseJson<T>(path: string, cookie: string): Promise<T> {
  const res = await fetch(`${NSE_BASE}${path}`, {
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: `${NSE_BASE}/market-data/all-upcoming-issues-ipo`,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    signal: AbortSignal.timeout(NSE_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`NSE HTTP ${res.status} for ${path}`);
  }
  return (await res.json()) as T;
}

function viewToLiveIpoRecord(v: IpoDbView): LiveIpoRecord {
  return {
    symbol: v.symbol,
    companyName: v.companyName,
    status: v.status.toUpperCase() as LiveIpoRecord['status'],
    issueType: v.series === 'SME' ? 'SME' : 'EQ',
    priceBandMin: v.priceLow ?? null,
    priceBandMax: v.priceHigh ?? null,
    lotSize: v.lotSize ?? null,
    issueSizeCr: v.issueSizeCr ?? null,
    openDate: v.openDate,
    closeDate: v.closeDate,
    allotmentDate: v.allotmentDate,
    listingDate: v.listingDate,
    registrar: v.registrar,
    qibMultiple: v.qibSubscription ?? null,
    niiMultiple: v.niiSubscription ?? null,
    riiMultiple: v.retailSubscription ?? null,
    totalMultiple: v.currentSubscription ?? null,
    gmpPrice: v.gmp ?? null,
    listingPrice: v.listingPrice ?? null,
    currentLtp: null,
    source: v.source || 'Supabase',
  };
}

export class IpoLiveService {
  static async getIpos(options: {
    status?: 'ALL' | 'OPEN' | 'UPCOMING' | 'CLOSED' | 'LISTED';
    refresh?: boolean;
  } = {}): Promise<LiveIpoListResult> {
    const status = options.status || 'ALL';
    const cacheKey = `${CACHE_KEY_PREFIX}${status}`;

    if (!options.refresh) {
      const cached = await cacheGet(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as LiveIpoListResult;
          return { ...parsed, source: 'cache' };
        } catch {
          // Ignore malformed cache
        }
      }
    }

    try {
      const cookie = await getNseSessionCookie();
      const [currentRaw, upcomingRaw] = await Promise.all([
        fetchNseJson<Array<Record<string, unknown>>>('/api/ipo-current-issue', cookie).catch(() => []),
        fetchNseJson<Array<Record<string, unknown>>>('/api/all-upcoming-issues?category=ipo', cookie).catch(() => []),
      ]);

      const combinedRaw: Array<Record<string, unknown> & { __stage: 'OPEN' | 'UPCOMING' }> = [
        ...(Array.isArray(currentRaw) ? currentRaw.map((r) => ({ ...r, __stage: 'OPEN' as const })) : []),
        ...(Array.isArray(upcomingRaw) ? upcomingRaw.map((r) => ({ ...r, __stage: 'UPCOMING' as const })) : []),
      ];

      if (combinedRaw.length === 0) {
        throw new Error('NSE returned empty IPO feeds');
      }

      const bySymbol = new Map<string, LiveIpoRecord>();

      for (const row of combinedRaw) {
        const symbol = String(row.symbol || '').trim().toUpperCase();
        const companyName = String(row.companyName || row.company_name || '').trim();
        if (!symbol || !companyName) continue;

        const { min, max } = parsePriceBand(row.issuePrice || row.priceBand);
        const seriesStr = String(row.series || row.issueType || '').toUpperCase();
        const issueType: 'EQ' | 'SME' = seriesStr.includes('SME') ? 'SME' : 'EQ';
        const openDate = parseNseDate(row.issueStartDate);
        const closeDate = parseNseDate(row.issueEndDate);
        const totalMultiple = toNumber(row.noOfTime);

        let qibMultiple: number | null = null;
        let niiMultiple: number | null = null;
        let riiMultiple: number | null = null;

        if (row.__stage === 'OPEN') {
          try {
            const bidInfo = await fetchNseJson<{
              dataList?: Array<Record<string, unknown>>;
            }>(`/api/ipo-detail-bid-info?symbol=${encodeURIComponent(symbol)}`, cookie);
            for (const b of bidInfo.dataList || []) {
              const cat = String(b.category || '').toUpperCase();
              const mult = toNumber(b.noOfTime);
              if (cat.includes('QIB')) qibMultiple = mult;
              else if (cat.includes('NII') || cat.includes('NON INSTITUTIONAL')) niiMultiple = mult;
              else if (cat.includes('RETAIL') || cat.includes('RII')) riiMultiple = mult;
            }
          } catch {
            // Bid breakdown optional if endpoint throttles
          }
        }

        const record: LiveIpoRecord = {
          symbol,
          companyName,
          status: row.__stage,
          issueType,
          priceBandMin: min,
          priceBandMax: max,
          lotSize: toNumber(row.lotSize),
          issueSizeCr: toNumber(row.issueSize),
          openDate,
          closeDate,
          allotmentDate: null,
          listingDate: parseNseDate(row.listingDate),
          registrar: row.registrar ? String(row.registrar) : null,
          qibMultiple,
          niiMultiple,
          riiMultiple,
          totalMultiple,
          gmpPrice: null,
          listingPrice: null,
          currentLtp: null,
          source: 'NSE India',
        };
        bySymbol.set(symbol, record);

        if (isDatabaseConfigured()) {
          const upsert: IpoUpsert = {
            id: `nse_${symbol}`,
            symbol,
            companyName,
            series: issueType,
            priceLow: min,
            priceHigh: max,
            lotSize: record.lotSize,
            issueSizeCr: record.issueSizeCr,
            freshIssueCr: null,
            ofsCr: null,
            openDate,
            closeDate,
            allotmentDate: null,
            listingDate: record.listingDate,
            registrar: record.registrar,
            registrarSlug: resolveRegistrarSlug(record.registrar),
            exchange: issueType === 'SME' ? 'NSE SME' : 'NSE',
            issuePrice: max,
            listingPrice: null,
            source: 'NSE India',
            extra: {},
          };
          const storedSymbol = await IpoRepository.upsert(upsert).catch(() => symbol);
          if (totalMultiple !== null) {
            await IpoRepository.recordSubscription(upsert.id, storedSymbol, {
              retail: riiMultiple,
              nii: niiMultiple,
              qib: qibMultiple,
              employee: null,
              total: totalMultiple,
            }).catch(() => {});
          }
        }
      }

      let items = [...bySymbol.values()];
      if (isDatabaseConfigured()) {
        const dbViews = await IpoRepository.listView().catch(() => []);
        const dbMapped = dbViews.map(viewToLiveIpoRecord);
        const merged = new Map(dbMapped.map((r) => [r.symbol, r]));
        for (const live of items) {
          const prev = merged.get(live.symbol);
          merged.set(live.symbol, prev ? { ...prev, ...live, gmpPrice: prev.gmpPrice } : live);
        }
        items = [...merged.values()];
      }

      const filtered = status === 'ALL' ? items : items.filter((i) => i.status === status);
      const result: LiveIpoListResult = {
        items: filtered,
        stale: false,
        source: 'nse',
        fetchedAt: new Date().toISOString(),
      };
      await cacheSet(cacheKey, JSON.stringify(result));
      return result;
    } catch {
      // Fall back to last cached snapshot or PostgreSQL rows with stale: true
      const staleCache = await cacheGet(cacheKey);
      if (staleCache) {
        try {
          const parsed = JSON.parse(staleCache) as LiveIpoListResult;
          return { ...parsed, stale: true, source: 'cache' };
        } catch {
          // Continue to DB
        }
      }
      if (isDatabaseConfigured()) {
        const dbViews = await IpoRepository.listView().catch(() => []);
        const dbRecords = dbViews.map(viewToLiveIpoRecord);
        const filtered = status === 'ALL' ? dbRecords : dbRecords.filter((i) => i.status === status);
        return {
          items: filtered,
          stale: true,
          source: 'database',
          fetchedAt: new Date().toISOString(),
        };
      }
      return {
        items: [],
        stale: true,
        source: 'database',
        fetchedAt: new Date().toISOString(),
      };
    }
  }
}
