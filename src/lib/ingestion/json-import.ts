import { normalizeCompanyName } from './bse';
import { toNumber } from './http';
import { IpoRepository, SNAPSHOT_SOURCE_PREFIX, type IpoUpsert } from '@/lib/repositories/ipo.repository';

/**
 * One-time import of the scraper snapshot in data/ipos.json (NSE/BSE lists + InvestorGain GMP).
 *
 * - An IPO already stored from InvestorGain/BSE (matched by normalised company name or symbol)
 *   is not overwritten; only the snapshot's GMP reading is added as a dated history point.
 * - An IPO not yet stored gets a row with only the fields the snapshot verifies, tagged
 *   `source = 'NSE/BSE snapshot <date>'`. A later InvestorGain record for it supersedes the row.
 *
 * Only the scraped feed is read. The hardcoded registries in src/config and src/services
 * (invented GMP, subscription and anchor values) are never imported.
 */

export interface SnapshotIpo {
  symbol?: string | null;
  companyName?: string | null;
  series?: string | null;
  platform?: string | null;
  exchanges?: string[] | null;
  openDate?: string | null;
  closeDate?: string | null;
  listingDate?: string | null;
  priceBand?: { min?: number | null; max?: number | null } | null;
  lotSize?: string | number | null;
  issueSize?: string | null;
  gmp?: { value?: number | null; percent?: number | null } | null;
}

export interface SnapshotFile {
  generatedAt?: string | null;
  ipos?: SnapshotIpo[];
}

export interface JsonImportReport {
  snapshotDate: string | null;
  total: number;
  matchedExisting: number;
  inserted: number;
  gmpPointsAdded: number;
  skipped: number;
  errors: string[];
}

const isoDate = (v: string | null | undefined): string | null =>
  v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

export function snapshotToUpsert(ipo: SnapshotIpo, snapshotDate: string | null): IpoUpsert | null {
  const symbol = (ipo.symbol || '').trim().toUpperCase().replace(/[^A-Z0-9&-]/g, '').slice(0, 32);
  const companyName = (ipo.companyName || '').trim();
  if (!symbol || !companyName) return null;
  const priceLow = toNumber(ipo.priceBand?.min);
  const priceHigh = toNumber(ipo.priceBand?.max);
  const isSme = ipo.series === 'SME' || ipo.platform === 'SME';
  return {
    id: `snap_${symbol}`,
    symbol,
    companyName,
    series: isSme ? 'SME' : 'EQ',
    priceLow,
    priceHigh,
    lotSize: toNumber(ipo.lotSize),
    issueSizeCr: toNumber(ipo.issueSize),
    freshIssueCr: null,
    ofsCr: null,
    openDate: isoDate(ipo.openDate),
    closeDate: isoDate(ipo.closeDate),
    allotmentDate: null,
    listingDate: isoDate(ipo.listingDate),
    registrar: null,
    registrarSlug: null,
    exchange: ipo.exchanges?.length ? ipo.exchanges.join(', ') : null,
    issuePrice: priceHigh,
    listingPrice: null,
    source: `${SNAPSHOT_SOURCE_PREFIX} ${snapshotDate ?? 'unknown'}`,
    extra: {},
  };
}

export async function importSnapshot(file: SnapshotFile): Promise<JsonImportReport> {
  const snapshotDate = isoDate(file.generatedAt?.slice(0, 10)) ?? null;
  const ipos = Array.isArray(file.ipos) ? file.ipos : [];
  const report: JsonImportReport = {
    snapshotDate,
    total: ipos.length,
    matchedExisting: 0,
    inserted: 0,
    gmpPointsAdded: 0,
    skipped: 0,
    errors: [],
  };

  const stored = await IpoRepository.listAll();
  const byName = new Map(stored.map((r) => [normalizeCompanyName(r.companyName), r]));
  const bySymbol = new Map(stored.map((r) => [r.symbol, r]));

  for (const ipo of ipos) {
    try {
      const rec = snapshotToUpsert(ipo, snapshotDate);
      if (!rec) {
        report.skipped++;
        continue;
      }
      const key = normalizeCompanyName(rec.companyName);
      const match =
        byName.get(key) ??
        (key.length >= 8
          ? [...byName.entries()].find(([n]) => n.length >= 8 && (n.startsWith(key) || key.startsWith(n)))?.[1]
          : undefined) ??
        bySymbol.get(rec.symbol);

      let target = { id: rec.id, symbol: rec.symbol, priceHigh: rec.priceHigh };
      if (match && !match.source?.startsWith(SNAPSHOT_SOURCE_PREFIX)) {
        report.matchedExisting++;
        target = { id: match.id, symbol: match.symbol, priceHigh: match.priceHigh };
      } else {
        await IpoRepository.upsert(rec);
        report.inserted++;
      }

      const gmp = toNumber(ipo.gmp?.value);
      if (gmp !== null && snapshotDate) {
        report.gmpPointsAdded += await IpoRepository.recordGmpPoints(
          target.id,
          target.symbol,
          target.priceHigh,
          [{ date: snapshotDate, gmp }],
          'InvestorGain (snapshot)'
        );
      }
    } catch (err) {
      report.errors.push(`${ipo.symbol ?? ipo.companyName}: ${(err as Error).message}`);
    }
  }
  return report;
}
