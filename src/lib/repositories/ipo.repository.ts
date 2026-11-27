import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { getRegistrar } from '@/lib/registrars';

export type IpoLifecycleStatus = 'Upcoming' | 'Open' | 'Closed' | 'Listed';

export interface AiGmpPrediction {
  predictedGainPct: number;
  predictedGmp: number | null;
  lowerPct: number;
  upperPct: number;
  modelVersion: string;
  drivers: Array<{ feature: string; contributionPct: number }>;
  createdAt: string;
}

/** Database view of one IPO: unknown values are null (never defaulted). */
export interface IpoDbView {
  id: string;
  symbol: string;
  companyName: string;
  status: IpoLifecycleStatus;
  series: 'EQ' | 'SME' | 'DEBT';
  priceBand: string;
  priceLow: number | null;
  priceHigh: number | null;
  lotSize: number | null;
  minInvestment?: number | null;
  issueSize: string;
  issueSizeCr?: number | null;
  freshIssueCr?: number | null;
  ofsCr?: number | null;
  ofsPercent?: number | null;
  openDate: string | null;
  closeDate: string | null;
  allotmentDate: string | null;
  listingDate: string | null;
  registrar: string | null;
  registrarSlug?: string | null;
  exchange?: string | null;
  registrarUrl?: string;
  peRatio?: number | null;
  sector?: string | null;
  rhpUrl?: string | null;
  drhpUrl?: string | null;
  anchorLockin30?: string | null;
  anchorLockin90?: string | null;
  source?: string | null;
  lastUpdated?: string | null;

  // Market GMP (informal grey-market indication, with source + time) and the separate AI prediction
  gmp: number | null;
  gmpPercent: number | null;
  gmpSource?: string | null;
  gmpUpdatedAt?: string | null;
  aiGmp?: AiGmpPrediction | null;

  // Subscription breakdown (latest snapshot)
  currentSubscription: number | null;
  retailSubscription: number | null;
  niiSubscription: number | null;
  qibSubscription: number | null;
  employeeSubscription?: number | null;
  subscriptionUpdatedAt?: string | null;
  listingGainPct?: number | null;
  remainingTime?: string;
  isClosingSoon?: boolean;

  // Secondary market metrics (when listed)
  isListed?: boolean;
  issuePrice?: number | null;
  listingPrice?: number | null;
  currentPrice?: number;
  previousClose?: number;
  dayChange?: number;
  dayChangePercent?: number;
  volume?: number;
  marketStatus?: 'OPEN' | 'CLOSED';
  isWatchlisted?: boolean;
}


/**
 * Single source of truth for IPO data. Ingestion writes here; every API route reads here.
 * Missing values stay null; nothing is defaulted or synthesised.
 */

export interface IpoExtra {
  igId?: number;
  rhpUrl?: string | null;
  drhpUrl?: string | null;
  sector?: string | null;
  peRatio?: number | null;
  postIssuePe?: number | null;
  marketCapCr?: number | null;
  promoterHoldingPre?: number | null;
  promoterHoldingPost?: number | null;
  anchorLockin30?: string | null;
  anchorLockin90?: string | null;
  anchorShares?: number | null;
  refundDate?: string | null;
  creditDate?: string | null;
  leadManagers?: string[];
  registrarWebsite?: string | null;
  bseScripCode?: number | null;
}

export interface IpoRecord {
  id: string;
  symbol: string;
  companyName: string;
  series: 'EQ' | 'SME';
  status: IpoLifecycleStatus;
  priceLow: number | null;
  priceHigh: number | null;
  lotSize: number | null;
  issueSizeCr: number | null;
  freshIssueCr: number | null;
  ofsCr: number | null;
  openDate: string | null;
  closeDate: string | null;
  allotmentDate: string | null;
  listingDate: string | null;
  registrar: string | null;
  registrarSlug: string | null;
  exchange: string | null;
  isin: string | null;
  issuePrice: number | null;
  listingPrice: number | null;
  source: string | null;
  fetchedAt: string | null;
  extra: IpoExtra;
}

export interface IpoUpsert {
  id: string;
  symbol: string;
  companyName: string;
  series: 'EQ' | 'SME';
  priceLow: number | null;
  priceHigh: number | null;
  lotSize: number | null;
  issueSizeCr: number | null;
  freshIssueCr: number | null;
  ofsCr: number | null;
  openDate: string | null;
  closeDate: string | null;
  allotmentDate: string | null;
  listingDate: string | null;
  registrar: string | null;
  registrarSlug: string | null;
  exchange: string | null;
  issuePrice: number | null;
  listingPrice: number | null;
  source: string;
  extra: IpoExtra;
}

const num = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const dec = (v: number | null | undefined, digits = 2): string | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : v.toFixed(digits);

/** Today's date in IST as YYYY-MM-DD (IPO calendars are Indian market days). */
export function todayIst(now = new Date()): string {
  return new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Derives the lifecycle stage from the issue calendar rather than trusting a scraped label. */
export function deriveStatus(
  r: { openDate: string | null; closeDate: string | null; listingDate: string | null; listingPrice: number | null },
  now = new Date()
): IpoLifecycleStatus {
  const today = todayIst(now);
  if (r.listingPrice !== null || (r.listingDate && today >= r.listingDate)) return 'Listed';
  if (r.closeDate && today > r.closeDate) return 'Closed';
  if (r.openDate && today >= r.openDate) return 'Open';
  return 'Upcoming';
}

function toRecord(r: typeof schema.iposTable.$inferSelect): IpoRecord {
  const base = {
    openDate: r.openDate,
    closeDate: r.closeDate,
    listingDate: r.listingDate,
    listingPrice: num(r.listingPrice),
  };
  return {
    id: r.id,
    symbol: r.symbol,
    companyName: r.companyName,
    series: (r.series === 'SME' ? 'SME' : 'EQ') as 'EQ' | 'SME',
    status: deriveStatus(base),
    priceLow: num(r.priceLow),
    priceHigh: num(r.priceHigh),
    lotSize: r.lotSize,
    issueSizeCr: num(r.issueSizeCr),
    freshIssueCr: num(r.freshIssueCr),
    ofsCr: num(r.ofsCr),
    openDate: r.openDate,
    closeDate: r.closeDate,
    allotmentDate: r.allotmentDate,
    listingDate: r.listingDate,
    registrar: r.registrar,
    registrarSlug: r.registrarSlug,
    exchange: r.exchange,
    isin: r.isin,
    issuePrice: num(r.issuePrice),
    listingPrice: num(r.listingPrice),
    source: r.source,
    fetchedAt: r.fetchedAt ? r.fetchedAt.toISOString() : null,
    extra: (r.raw as IpoExtra) || {},
  };
}

export class IpoRepository {
  static async upsert(rec: IpoUpsert): Promise<void> {
    const db = getDb();
    const now = new Date();
    const values = {
      id: rec.id,
      symbol: rec.symbol,
      companyName: rec.companyName,
      status: deriveStatus(rec),
      series: rec.series,
      priceLow: dec(rec.priceLow),
      priceHigh: dec(rec.priceHigh),
      lotSize: rec.lotSize,
      issueSize: rec.issueSizeCr !== null ? `₹${rec.issueSizeCr} Cr` : null,
      issueSizeCr: dec(rec.issueSizeCr),
      freshIssueCr: dec(rec.freshIssueCr),
      ofsCr: dec(rec.ofsCr),
      openDate: rec.openDate,
      closeDate: rec.closeDate,
      allotmentDate: rec.allotmentDate,
      listingDate: rec.listingDate,
      registrar: rec.registrar,
      registrarSlug: rec.registrarSlug,
      exchange: rec.exchange,
      issuePrice: dec(rec.issuePrice),
      listingPrice: dec(rec.listingPrice),
      source: rec.source,
      fetchedAt: now,
      raw: rec.extra,
      updatedAt: now,
    };

    // If the symbol changed (e.g. NSE symbol published after we first saw the issue), move
    // the user's applications along with it so allotment checks keep working.
    const existing = await db
      .select({ symbol: schema.iposTable.symbol })
      .from(schema.iposTable)
      .where(eq(schema.iposTable.id, rec.id))
      .limit(1);
    if (existing[0] && existing[0].symbol !== rec.symbol) {
      await db
        .update(schema.ipoApplicationsTable)
        .set({ ipoSymbol: rec.symbol })
        .where(eq(schema.ipoApplicationsTable.ipoSymbol, existing[0].symbol));
    }

    await db
      .insert(schema.iposTable)
      .values(values)
      .onConflictDoUpdate({ target: schema.iposTable.id, set: { ...values, createdAt: undefined } });
  }

  static async getBySymbol(symbol: string): Promise<IpoRecord | null> {
    const rows = await getDb()
      .select()
      .from(schema.iposTable)
      .where(eq(schema.iposTable.symbol, symbol.toUpperCase()))
      .limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  static async getById(id: string): Promise<IpoRecord | null> {
    const rows = await getDb().select().from(schema.iposTable).where(eq(schema.iposTable.id, id)).limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  static async listAll(): Promise<IpoRecord[]> {
    const rows = await getDb().select().from(schema.iposTable).orderBy(desc(schema.iposTable.openDate));
    return rows.map(toRecord);
  }

  static async recordSubscription(
    ipoId: string,
    symbol: string,
    s: { retail: number | null; nii: number | null; qib: number | null; employee: number | null; total: number | null }
  ): Promise<void> {
    if (s.total === null) return;
    const db = getDb();
    // Skip identical consecutive snapshots to keep the history meaningful.
    const last = await db
      .select()
      .from(schema.ipoSubscriptionsTable)
      .where(eq(schema.ipoSubscriptionsTable.symbol, symbol))
      .orderBy(desc(schema.ipoSubscriptionsTable.recordedAt))
      .limit(1);
    if (last[0] && Number(last[0].total) === s.total && Number(last[0].retail) === (s.retail ?? 0)) return;
    await db.insert(schema.ipoSubscriptionsTable).values({
      ipoId,
      symbol,
      retail: (s.retail ?? 0).toFixed(2),
      nii: (s.nii ?? 0).toFixed(2),
      qib: (s.qib ?? 0).toFixed(2),
      employee: (s.employee ?? 0).toFixed(2),
      total: s.total.toFixed(2),
    });
  }

  /** Inserts market GMP observations, one per (symbol, day, source). */
  static async recordGmpPoints(
    ipoId: string,
    symbol: string,
    priceHigh: number | null,
    points: Array<{ date: string; gmp: number }>,
    source: string
  ): Promise<number> {
    if (!points.length) return 0;
    const db = getDb();
    const existing = await db
      .select({ recordedAt: schema.ipoGmpHistoryTable.recordedAt })
      .from(schema.ipoGmpHistoryTable)
      .where(and(eq(schema.ipoGmpHistoryTable.symbol, symbol), eq(schema.ipoGmpHistoryTable.source, source)));
    const seen = new Set(existing.map((e) => e.recordedAt.toISOString().slice(0, 10)));
    const fresh = points.filter((p) => !seen.has(p.date));
    if (!fresh.length) return 0;
    const fetchedAt = new Date();
    await db.insert(schema.ipoGmpHistoryTable).values(
      fresh.map((p) => ({
        ipoId,
        symbol,
        gmp: p.gmp.toFixed(2),
        gmpPercent: priceHigh ? ((p.gmp / priceHigh) * 100).toFixed(2) : null,
        source,
        recordedAt: new Date(`${p.date}T12:00:00+05:30`),
        fetchedAt,
      }))
    );
    return fresh.length;
  }

  static async gmpHistory(symbol: string) {
    const rows = await getDb()
      .select()
      .from(schema.ipoGmpHistoryTable)
      .where(eq(schema.ipoGmpHistoryTable.symbol, symbol.toUpperCase()))
      .orderBy(schema.ipoGmpHistoryTable.recordedAt);
    return rows.map((r) => ({
      date: r.recordedAt.toISOString().slice(0, 10),
      gmp: Number(r.gmp),
      gmpPercent: num(r.gmpPercent),
      source: r.source || 'unknown',
      fetchedAt: (r.fetchedAt || r.recordedAt).toISOString(),
    }));
  }

  static async latestSubscription(symbol: string) {
    const rows = await getDb()
      .select()
      .from(schema.ipoSubscriptionsTable)
      .where(eq(schema.ipoSubscriptionsTable.symbol, symbol.toUpperCase()))
      .orderBy(desc(schema.ipoSubscriptionsTable.recordedAt))
      .limit(1);
    const r = rows[0];
    return r
      ? {
          retail: Number(r.retail),
          nii: Number(r.nii),
          qib: Number(r.qib),
          employee: num(r.employee),
          total: Number(r.total),
          recordedAt: r.recordedAt.toISOString(),
        }
      : null;
  }

  /** Builds the API view (one shape for every IPO endpoint) with latest subscription, GMP and AI prediction. */
  static async listView(filter?: { status?: IpoLifecycleStatus; symbols?: string[] }): Promise<IpoDbView[]> {
    const db = getDb();
    let records = await this.listAll();
    if (filter?.symbols?.length) {
      const wanted = new Set(filter.symbols.map((s) => s.toUpperCase()));
      records = records.filter((r) => wanted.has(r.symbol));
    }
    if (filter?.status) records = records.filter((r) => r.status === filter.status);
    if (!records.length) return [];
    const symbols = records.map((r) => r.symbol);

    const [subs, gmps, preds] = await Promise.all([
      db
        .selectDistinctOn([schema.ipoSubscriptionsTable.symbol])
        .from(schema.ipoSubscriptionsTable)
        .where(inArray(schema.ipoSubscriptionsTable.symbol, symbols))
        .orderBy(schema.ipoSubscriptionsTable.symbol, desc(schema.ipoSubscriptionsTable.recordedAt)),
      db
        .selectDistinctOn([schema.ipoGmpHistoryTable.symbol])
        .from(schema.ipoGmpHistoryTable)
        .where(inArray(schema.ipoGmpHistoryTable.symbol, symbols))
        .orderBy(schema.ipoGmpHistoryTable.symbol, desc(schema.ipoGmpHistoryTable.recordedAt)),
      db
        .selectDistinctOn([schema.gmpPredictionsTable.symbol])
        .from(schema.gmpPredictionsTable)
        .where(inArray(schema.gmpPredictionsTable.symbol, symbols))
        .orderBy(schema.gmpPredictionsTable.symbol, desc(schema.gmpPredictionsTable.createdAt)),
    ]);
    const subBy = new Map(subs.map((s) => [s.symbol, s]));
    const gmpBy = new Map(gmps.map((g) => [g.symbol, g]));
    const predBy = new Map(preds.map((p) => [p.symbol, p]));

    return records.map((r) => toView(r, subBy.get(r.symbol), gmpBy.get(r.symbol), predBy.get(r.symbol)));
  }

  static async countBy(): Promise<Record<IpoLifecycleStatus, number>> {
    const all = await this.listAll();
    const out: Record<IpoLifecycleStatus, number> = { Upcoming: 0, Open: 0, Closed: 0, Listed: 0 };
    for (const r of all) out[r.status]++;
    return out;
  }

  static async ping(): Promise<boolean> {
    await getDb().execute(sql`select 1`);
    return true;
  }
}

function toView(
  r: IpoRecord,
  sub?: typeof schema.ipoSubscriptionsTable.$inferSelect,
  gmp?: typeof schema.ipoGmpHistoryTable.$inferSelect,
  pred?: typeof schema.gmpPredictionsTable.$inferSelect
): IpoDbView {
  const registrar = getRegistrar(r.registrarSlug);
  const totalIssue = (r.freshIssueCr ?? 0) + (r.ofsCr ?? 0);
  // For listed issues this is the final pre-listing GMP (useful to compare with the actual listing).
  const gmpValue = gmp ? Number(gmp.gmp) : null;
  const issuePrice = r.issuePrice ?? r.priceHigh;
  return {
    id: r.id,
    symbol: r.symbol,
    companyName: r.companyName,
    status: r.status,
    series: r.series,
    priceBand:
      r.priceLow !== null && r.priceHigh !== null
        ? r.priceLow === r.priceHigh
          ? `₹${r.priceHigh}`
          : `₹${r.priceLow} - ₹${r.priceHigh}`
        : '—',
    priceLow: r.priceLow,
    priceHigh: r.priceHigh,
    lotSize: r.lotSize,
    minInvestment: r.lotSize && r.priceHigh ? r.lotSize * r.priceHigh : null,
    issueSize: r.issueSizeCr !== null ? `₹${r.issueSizeCr.toLocaleString('en-IN')} Cr` : '—',
    issueSizeCr: r.issueSizeCr,
    freshIssueCr: r.freshIssueCr,
    ofsCr: r.ofsCr,
    ofsPercent: totalIssue > 0 && r.ofsCr !== null ? Math.round(((r.ofsCr / totalIssue) * 100) * 10) / 10 : null,
    openDate: r.openDate,
    closeDate: r.closeDate,
    allotmentDate: r.allotmentDate,
    listingDate: r.listingDate,
    registrar: r.registrar,
    registrarSlug: r.registrarSlug,
    exchange: r.exchange,
    registrarUrl: registrar.portalUrl,
    peRatio: r.extra.peRatio ?? null,
    sector: r.extra.sector ?? null,
    rhpUrl: r.extra.rhpUrl ?? null,
    drhpUrl: r.extra.drhpUrl ?? null,
    anchorLockin30: r.extra.anchorLockin30 ?? null,
    anchorLockin90: r.extra.anchorLockin90 ?? null,

    gmp: gmpValue,
    gmpPercent: gmp?.gmpPercent !== undefined && gmp?.gmpPercent !== null ? Number(gmp.gmpPercent) : null,
    gmpSource: gmp?.source ?? null,
    gmpUpdatedAt: gmp ? (gmp.fetchedAt || gmp.recordedAt).toISOString() : null,
    aiGmp: pred
      ? {
          predictedGainPct: pred.predictedGainPct,
          predictedGmp: pred.predictedGmp,
          lowerPct: pred.lowerPct,
          upperPct: pred.upperPct,
          modelVersion: pred.modelVersion,
          drivers: pred.drivers as Array<{ feature: string; contributionPct: number }>,
          createdAt: pred.createdAt.toISOString(),
        }
      : null,

    currentSubscription: sub ? Number(sub.total) : null,
    retailSubscription: sub ? Number(sub.retail) : null,
    niiSubscription: sub ? Number(sub.nii) : null,
    qibSubscription: sub ? Number(sub.qib) : null,
    employeeSubscription: sub?.employee !== undefined && sub?.employee !== null ? Number(sub.employee) : null,
    subscriptionUpdatedAt: sub ? sub.recordedAt.toISOString() : null,

    isListed: r.status === 'Listed',
    issuePrice,
    listingPrice: r.listingPrice,
    listingGainPct:
      r.listingPrice !== null && issuePrice ? Math.round(((r.listingPrice - issuePrice) / issuePrice) * 10000) / 100 : null,

    source: r.source,
    lastUpdated: r.fetchedAt,
  };
}
