import { fetchJson, fetchText, stripHtml, toNumber, UpstreamError } from './http';

/**
 * InvestorGain client: the live IPO report (list + market GMP) and the per-IPO detail payload
 * (registrar, symbol, fresh issue / OFS, dates, RHP/DRHP links, category bids, GMP history).
 *
 * GMP is an informal, unregulated grey-market indication. It is stored and displayed with its
 * source and timestamp, never presented as an official price.
 */

const SOURCE = 'InvestorGain';
const REPORT_URL = 'https://webnodejs.investorgain.com/cloud/v2/report/data-read/331/1';
const REFERER = 'https://www.investorgain.com/report/live-ipo-gmp/331/ipo/';

/** Loosely-typed JSON records from InvestorGain (primitive fields only). */
export type IgRecord = Record<string, string | number | boolean | null | undefined>;

export interface IgDetailPayload {
  ipoData?: IgRecord[];
  registrarInfo?: IgRecord[];
  biddingData?: { ipoBiddingData?: IgRecord[] };
  gmpData?: IgRecord[];
  ipoLeadManagersList?: IgRecord[];
}

/** String value or null (empty strings become null). */
const str = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v));

export interface IgReportRow {
  igId: number;
  name: string;
  statusCode: string; // U | O | CT | LT | LP | LN
  category: 'IPO' | 'SME' | string;
  gmp: number | null;
  gmpPercent: number | null;
  subscriptionTimes: number | null;
  price: number | null;
  issueSizeCr: number | null;
  lotSize: number | null;
  peRatio: number | null;
  openDate: string | null;
  closeDate: string | null;
  allotmentDate: string | null;
  listingDate: string | null;
  listingPrice: number | null;
  updatedOn: string | null;
}

function fiscalYear(d: Date): string {
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

export function parseReportRow(r: IgRecord): IgReportRow | null {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  const igId = toNumber(r['~id']);
  if (!igId) return null;
  const gmpMatch = /₹\s*<b>([^<]*)<\/b>\s*\(([^)]*)\)/i.exec(String(r.GMP || '').replace(/&#8377;/g, '₹'));
  const listingMatch = /L@\s*([0-9.,]+)/.exec(String(r.Name || ''));
  return {
    igId,
    name: stripHtml(str(r['~ipo_name']) ?? str(r.Name)),
    statusCode: String(r['~ipo_status1'] || ''),
    category: String(r['~IPO_Category'] || r['~ipo_category1'] || 'IPO'),
    gmp: gmpMatch ? toNumber(gmpMatch[1]) : null,
    gmpPercent: gmpMatch ? toNumber(gmpMatch[2]) : null,
    subscriptionTimes: toNumber(r.Sub),
    price: toNumber(r['Price (₹)']),
    issueSizeCr: toNumber(r['IPO Size']),
    lotSize: toNumber(r.Lot),
    peRatio: toNumber(r['~P/E']),
    openDate: str(r['~Srt_Open']),
    closeDate: str(r['~Srt_Close']),
    allotmentDate: str(r['~Srt_BoA_Dt']),
    listingDate: str(r['~Str_Listing']),
    listingPrice: listingMatch ? toNumber(listingMatch[1]) : null,
    updatedOn: stripHtml(str(r['Updated-On'])) || null,
  };
}

export async function fetchLiveReport(now = new Date()): Promise<IgReportRow[]> {
  const url = `${REPORT_URL}/${now.getMonth() + 1}/${now.getFullYear()}/${fiscalYear(now)}/0/all?search=`;
  const data = await fetchJson<{ reportTableData?: unknown }>(SOURCE, url, {
    headers: { Referer: REFERER, Origin: 'https://www.investorgain.com' },
  });
  if (!Array.isArray(data.reportTableData)) {
    throw new UpstreamError(SOURCE, 'Unexpected reportTableData shape from live report');
  }
  return data.reportTableData.map((r) => parseReportRow(r as IgRecord)).filter((r): r is IgReportRow => r !== null);
}

// ---------------------------------------------------------------------------
// Detail page: the Next.js payload embeds a JSON response object; extract it.
// ---------------------------------------------------------------------------

const BS = '\\';

/** Extracts the embedded `ig_ipo_detail_v2` JSON object from the HTML of an IPO detail page. */
export function extractDetailPayload(html: string): IgDetailPayload | null {
  const marker = `{${BS}"msg${BS}":1,${BS}"cacheKey${BS}":${BS}"ig_ipo_detail_v2`;
  const start = html.indexOf(marker);
  if (start === -1) return null;

  // Decode the enclosing JS string literal first so escaped quotes inside JSON strings are handled cleanly.
  const quoteStart = start > 0 && html[start - 1] === '"' ? start - 1 : -1;
  let decoded: string | null = null;
  if (quoteStart !== -1) {
    let end = start;
    for (; end < html.length; end++) {
      const ch = html[end];
      if (ch === BS) {
        end++;
        continue;
      }
      if (ch === '"') break;
    }
    if (end < html.length) {
      try {
        const parsed = JSON.parse(html.slice(quoteStart, end + 1));
        if (typeof parsed === 'string') decoded = parsed;
      } catch {
        decoded = null;
      }
    }
  }

  if (!decoded) {
    let depth = 0;
    let inString = false;
    let i = start;
    for (; i < html.length; i++) {
      const c = html[i];
      if (c === BS) {
        if (html[i + 1] === '"') inString = !inString;
        i++;
        continue;
      }
      if (inString) continue;
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
    try {
      return JSON.parse(JSON.parse(`"${html.slice(start, i)}"`));
    } catch {
      return null;
    }
  }

  let depth = 0;
  let inString = false;
  let i = 0;
  for (; i < decoded.length; i++) {
    const c = decoded[i];
    if (inString) {
      if (c === BS) {
        i++;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  try {
    return JSON.parse(decoded.slice(0, i));
  } catch {
    return null;
  }
}

export interface IgCategoryBids {
  recordedAt: string;
  qib: number | null;
  nii: number | null;
  retail: number | null;
  employee: number | null;
  total: number | null;
}

export interface IgGmpPoint {
  date: string; // YYYY-MM-DD
  gmp: number;
  estimatedListingPrice: number | null;
}

export interface IgIpoDetail {
  igId: number;
  companyName: string;
  shortName: string;
  nseSymbol: string | null;
  bseCode: string | null;
  category: 'EQ' | 'SME';
  exchanges: string | null;
  priceLow: number | null;
  priceHigh: number | null;
  finalPrice: number | null;
  lotSize: number | null;
  issueSizeCr: number | null;
  freshIssueCr: number | null;
  ofsCr: number | null;
  openDate: string | null;
  closeDate: string | null;
  allotmentDate: string | null;
  refundDate: string | null;
  creditDate: string | null;
  listingDate: string | null;
  listingPrice: number | null;
  registrarName: string | null;
  registrarWebsite: string | null;
  registrarEmail: string | null;
  rhpUrl: string | null;
  drhpUrl: string | null;
  sector: string | null;
  peRatio: number | null;
  postIssuePe: number | null;
  marketCapCr: number | null;
  promoterHoldingPre: number | null;
  promoterHoldingPost: number | null;
  anchorLockin30: string | null;
  anchorLockin90: string | null;
  anchorShares: number | null;
  leadManagers: string[];
  bids: IgCategoryBids | null;
  gmpHistory: IgGmpPoint[];
}

const isoDate = (v: unknown): string | null => {
  if (!v || typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
};

/** "27-11-2026" -> "2026-11-27" */
const dmyToIso = (v: string): string | null => {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/** "3rd Dec 2026" -> "2026-12-03" */
const ordinalToIso = (v: unknown): string | null => {
  if (!v || typeof v !== 'string') return null;
  const d = new Date(v.replace(/(\d+)(st|nd|rd|th)/, '$1') + ' UTC');
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const ratio = (bid: unknown, offered: unknown): number | null => {
  const b = toNumber(bid);
  const o = toNumber(offered);
  return b !== null && o ? Math.round((b / o) * 100) / 100 : null;
};

export function parseDetailPayload(payload: IgDetailPayload): IgIpoDetail | null {
  const d = payload?.ipoData?.[0];
  if (!d) return null;
  const registrar = payload.registrarInfo?.[0];
  const websiteMatch = /href="([^"]+)"/.exec(str(registrar?.registrar_basic_info) ?? '');
  const bidsRaw = payload.biddingData?.ipoBiddingData;
  let lastBid: IgRecord | null = null;
  if (Array.isArray(bidsRaw) && bidsRaw.length) {
    lastBid = bidsRaw[bidsRaw.length - 1];
    let latestMs = Number.NEGATIVE_INFINITY;
    for (const row of bidsRaw) {
      const ms = Date.parse(String(row?.bid_date || ''));
      if (!Number.isNaN(ms) && ms >= latestMs) {
        latestMs = ms;
        lastBid = row;
      }
    }
  }

  const positive = (n: number | null) => (n !== null && n > 0 ? n : null);
  const crore = (amt: unknown) => {
    const n = toNumber(amt);
    return n !== null ? Math.round((n / 1e7) * 100) / 100 : null;
  };

  // Fixed-price issues (common on SME) publish one price in `issue_price` instead of a band.
  const band = String(d.issue_price || d.max_price_to_display || '')
    .split('-')
    .map((p) => toNumber(p))
    .filter((p): p is number => p !== null);
  const priceLow = toNumber(d.issue_price_lower) ?? band[0] ?? null;
  const priceHigh = toNumber(d.issue_price_upper) ?? band[band.length - 1] ?? priceLow;

  return {
    igId: Number(d.id),
    companyName: stripHtml(str(d.company_name)),
    shortName: stripHtml(str(d.company_short_name) ?? str(d.company_name)),
    nseSymbol: d.nse_symbol ? String(d.nse_symbol).trim().toUpperCase() : null,
    bseCode: d.bse_scripcode ? String(d.bse_scripcode).trim() : null,
    category: String(d.issue_category || '').toUpperCase().includes('SME') ? 'SME' : 'EQ',
    exchanges: str(d.ipo_listing_at),
    priceLow,
    priceHigh,
    finalPrice: toNumber(d.issue_price_final),
    lotSize: toNumber(d.market_lot_size),
    issueSizeCr: positive(crore(d.issue_size_in_amt)) ?? positive(toNumber(d.issue_size)) ?? positive((crore(d.issue_size_fresh_in_amt) ?? 0) + (crore(d.issue_size_ofs_in_amt) ?? 0)),
    freshIssueCr: crore(d.issue_size_fresh_in_amt),
    ofsCr: crore(d.issue_size_ofs_in_amt),
    openDate: isoDate(d.issue_open_date),
    closeDate: isoDate(d.issue_extend_close_date) || isoDate(d.issue_close_date),
    allotmentDate: isoDate(d.timetable_boa_dt),
    refundDate: isoDate(d.timetable_refunds_dt),
    creditDate: isoDate(d.timetable_share_credit_dt),
    listingDate: ordinalToIso(d.timetable_listing_dt),
    listingPrice: positive(toNumber(d.listing_price)),
    registrarName: registrar?.registrar_name ? stripHtml(String(registrar.registrar_name)) : null,
    registrarWebsite: websiteMatch ? websiteMatch[1] : null,
    registrarEmail: str(d.registrar_email),
    rhpUrl: str(d.prospectus_rhp),
    drhpUrl: str(d.prospectus_drhp),
    sector: str(d.company_sector),
    peRatio: toNumber(d.pe_ratio),
    postIssuePe: toNumber(d.post_pe_ratio),
    marketCapCr: toNumber(d.market_cap),
    promoterHoldingPre: toNumber(d.promoter_shareholding_pre_issue),
    promoterHoldingPost: toNumber(d.promoter_shareholding_post_issue),
    anchorLockin30: isoDate(d.timetable_anchor_lockin_end_dt_1),
    anchorLockin90: isoDate(d.timetable_anchor_lockin_end_dt_2),
    anchorShares: toNumber(d.shares_offered_anchor_investor),
    leadManagers: (payload.ipoLeadManagersList || []).map((l) => stripHtml(str(l.comp_name))).filter(Boolean),
    bids: lastBid
      ? {
          recordedAt: String(lastBid.bid_date || ''),
          qib: ratio(lastBid.qib_shares_bid_for, lastBid.qib_offered),
          nii: ratio(lastBid.nii_shares_bid_for, lastBid.nii_offered),
          retail: ratio(lastBid.rii_shares_bid_for, lastBid.rii_offered),
          employee: ratio(lastBid.emp_shares_bid_for, lastBid.emp_offered),
          total: ratio(lastBid.total_shares_bid_for, lastBid.total_offered),
        }
      : null,
    gmpHistory: (payload.gmpData || [])
      .map((g): IgGmpPoint | null => {
        const date = dmyToIso(String(g.gmp_date || ''));
        const gmp = toNumber(g.gmp);
        return date && gmp !== null ? { date, gmp, estimatedListingPrice: toNumber(g.estimated_listing_price) } : null;
      })
      .filter((g): g is IgGmpPoint => g !== null),
  };
}

export async function fetchIpoDetail(igId: number): Promise<IgIpoDetail> {
  // The slug segment is ignored by the site; the numeric id is authoritative.
  const html = await fetchText(SOURCE, `https://www.investorgain.com/ipo/ipo/${igId}/`, {
    headers: { Accept: 'text/html' },
    timeoutMs: 20000,
  });
  const payload = extractDetailPayload(html);
  const detail = payload ? parseDetailPayload(payload) : null;
  if (!detail) throw new UpstreamError(SOURCE, `Could not parse IPO detail payload for id ${igId}`);
  return detail;
}
