import { fetchLiveReport, fetchIpoDetail, type IgIpoDetail, type IgReportRow } from './investorgain';
import { fetchBsePublicIssues, normalizeCompanyName, type BseIssue } from './bse';
import { IpoRepository, type IpoUpsert } from '@/lib/repositories/ipo.repository';
import { resolveRegistrarSlug } from '@/lib/registrars';

/**
 * Live IPO ingestion: InvestorGain live report + per-IPO detail, cross-checked against BSE's
 * official public-issue list, upserted into Postgres. Runs from the Inngest cron (and the
 * protected /api/scraper/sync trigger); never in the user request path.
 */

export interface IngestionReport {
  startedAt: string;
  finishedAt: string;
  reportRows: number;
  detailsFetched: number;
  upserted: number;
  gmpPointsAdded: number;
  bseIssues: number;
  bseOnlyAdded: number;
  errors: string[];
}

/** A stable symbol: NSE symbol, else BSE code, else a deterministic slug from the name. */
export function deriveSymbol(detail: Pick<IgIpoDetail, 'nseSymbol' | 'bseCode' | 'shortName' | 'igId'>): string {
  if (detail.nseSymbol) return detail.nseSymbol.slice(0, 32);
  if (detail.bseCode) return `BSE${detail.bseCode}`.slice(0, 32);
  const slug = detail.shortName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
  return slug || `IG${detail.igId}`;
}

export function detailToUpsert(detail: IgIpoDetail, row?: IgReportRow): IpoUpsert {
  const registrarSlug = resolveRegistrarSlug(detail.registrarName, detail.registrarEmail, detail.registrarWebsite);
  return {
    id: `ig_${detail.igId}`,
    symbol: deriveSymbol(detail),
    companyName: detail.companyName || detail.shortName,
    series: detail.category,
    priceLow: detail.priceLow,
    priceHigh: detail.priceHigh,
    lotSize: detail.lotSize,
    issueSizeCr: detail.issueSizeCr,
    freshIssueCr: detail.freshIssueCr,
    ofsCr: detail.ofsCr,
    openDate: detail.openDate ?? row?.openDate ?? null,
    closeDate: detail.closeDate ?? row?.closeDate ?? null,
    allotmentDate: detail.allotmentDate ?? row?.allotmentDate ?? null,
    listingDate: detail.listingDate ?? row?.listingDate ?? null,
    registrar: detail.registrarName,
    registrarSlug,
    exchange: detail.exchanges,
    issuePrice: detail.finalPrice ?? detail.priceHigh,
    listingPrice: detail.listingPrice ?? row?.listingPrice ?? null,
    source: 'InvestorGain',
    extra: {
      igId: detail.igId,
      rhpUrl: detail.rhpUrl,
      drhpUrl: detail.drhpUrl,
      sector: detail.sector,
      peRatio: detail.peRatio ?? row?.peRatio ?? null,
      postIssuePe: detail.postIssuePe,
      marketCapCr: detail.marketCapCr,
      promoterHoldingPre: detail.promoterHoldingPre,
      promoterHoldingPost: detail.promoterHoldingPost,
      anchorLockin30: detail.anchorLockin30,
      anchorLockin90: detail.anchorLockin90,
      anchorShares: detail.anchorShares,
      refundDate: detail.refundDate,
      creditDate: detail.creditDate,
      leadManagers: detail.leadManagers,
      registrarWebsite: detail.registrarWebsite,
      bseScripCode: detail.bseCode && /^\d{6}$/.test(detail.bseCode) ? Number(detail.bseCode) : null,
    },
  };
}

function bseToUpsert(b: BseIssue): IpoUpsert {
  return {
    id: `bse_${b.scripCode}`,
    symbol: `BSE${b.scripCode}`,
    companyName: b.name,
    series: b.platform === 'SME' ? 'SME' : 'EQ',
    priceLow: b.priceLow,
    priceHigh: b.priceHigh,
    lotSize: null,
    issueSizeCr: null,
    freshIssueCr: null,
    ofsCr: null,
    openDate: b.openDate,
    closeDate: b.closeDate,
    allotmentDate: null,
    listingDate: null,
    registrar: null,
    registrarSlug: null,
    exchange: 'BSE',
    issuePrice: b.priceHigh,
    listingPrice: null,
    source: 'BSE',
    extra: { bseScripCode: b.scripCode },
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
      await new Promise((r) => setTimeout(r, 400)); // be polite to upstream
    }
  });
  await Promise.all(workers);
  return results;
}

export async function ingestIgDetail(detail: IgIpoDetail, row?: IgReportRow): Promise<{ gmpPoints: number }> {
  const rec = detailToUpsert(detail, row);
  await IpoRepository.upsert(rec);
  if (detail.bids) await IpoRepository.recordSubscription(rec.id, rec.symbol, detail.bids);

  // Real daily GMP history from the detail payload, plus today's report value.
  const points = [...detail.gmpHistory.map((g) => ({ date: g.date, gmp: g.gmp }))];
  const gmpPoints = await IpoRepository.recordGmpPoints(rec.id, rec.symbol, rec.priceHigh, points, 'InvestorGain');
  return { gmpPoints };
}

export async function runIpoIngestion(options: { detailIds?: number[] } = {}): Promise<IngestionReport> {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  let reportRows: IgReportRow[] = [];
  try {
    reportRows = await fetchLiveReport();
  } catch (err) {
    errors.push(`report: ${(err as Error).message}`);
  }

  const ids = options.detailIds ?? reportRows.map((r) => r.igId);
  const rowById = new Map(reportRows.map((r) => [r.igId, r]));
  let upserted = 0;
  let gmpPointsAdded = 0;
  const igNames = new Set<string>();

  const results = await mapLimit(ids, 3, async (id) => {
    const detail = await fetchIpoDetail(id);
    const { gmpPoints } = await ingestIgDetail(detail, rowById.get(id));
    igNames.add(normalizeCompanyName(detail.companyName));
    igNames.add(normalizeCompanyName(detail.shortName));
    return gmpPoints;
  });
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      upserted++;
      gmpPointsAdded += r.value;
    } else errors.push(`detail ${ids[i]}: ${(r.reason as Error)?.message}`);
  });

  // Official BSE list: add any issue InvestorGain has not covered yet (dates/price band only).
  let bseIssues: BseIssue[] = [];
  let bseOnlyAdded = 0;
  try {
    bseIssues = await fetchBsePublicIssues();
    for (const b of bseIssues) {
      const key = normalizeCompanyName(b.name);
      const covered = [...igNames].some((n) => n && (key.startsWith(n) || n.startsWith(key)));
      if (!covered && b.status !== 'other') {
        const existing = await IpoRepository.getById(`bse_${b.scripCode}`);
        if (!existing || existing.source === 'BSE') {
          await IpoRepository.upsert(bseToUpsert(b));
          bseOnlyAdded++;
        }
      }
    }
  } catch (err) {
    errors.push(`bse: ${(err as Error).message}`);
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    reportRows: reportRows.length,
    detailsFetched: ids.length,
    upserted,
    gmpPointsAdded,
    bseIssues: bseIssues.length,
    bseOnlyAdded,
    errors,
  };
}
