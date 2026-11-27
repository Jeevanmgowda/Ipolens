import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { IpoRepository, type IpoRecord } from '@/lib/repositories/ipo.repository';

/**
 * AI listing-gain / GMP estimate.
 *
 * A ridge regression trained on real listed IPOs in the database (target: actual listing gain %).
 * It intentionally does NOT use market GMP as an input, so it is an independent estimate that can
 * be shown next to the scraped market GMP. With too little history it refuses to predict.
 */

export const FEATURES = [
  'qibSubscription',
  'niiSubscription',
  'retailSubscription',
  'issueSize',
  'ofsShare',
  'smePlatform',
  'peRatio',
  'peMissing',
] as const;
type Feature = (typeof FEATURES)[number];

export const FEATURE_LABELS: Record<Feature, string> = {
  qibSubscription: 'QIB subscription',
  niiSubscription: 'NII subscription',
  retailSubscription: 'Retail subscription',
  issueSize: 'Issue size',
  ofsShare: 'Offer-for-sale share',
  smePlatform: 'SME platform',
  peRatio: 'Issue P/E',
  peMissing: 'P/E not available',
};

export interface RawInputs {
  qib: number;
  nii: number;
  retail: number;
  issueSizeCr: number | null;
  freshIssueCr: number | null;
  ofsCr: number | null;
  series: 'EQ' | 'SME';
  peRatio: number | null;
}

export interface GmpModel {
  version: string;
  means: number[];
  stds: number[];
  weights: number[]; // standardized-space weights (no intercept)
  intercept: number;
  residualStd: number;
  trainedOn: number;
  metrics: { mae: number; r2: number; lambda: number };
}

export const MIN_TRAINING_ROWS = 12;

export function featureVector(x: RawInputs, peFallback = 25): number[] {
  const total = (x.freshIssueCr ?? 0) + (x.ofsCr ?? 0);
  const ofsShare = total > 0 && x.ofsCr !== null ? x.ofsCr / total : 0;
  const pe = x.peRatio !== null && x.peRatio > 0 ? Math.min(x.peRatio, 200) : null;
  return [
    Math.log1p(Math.max(0, x.qib)),
    Math.log1p(Math.max(0, x.nii)),
    Math.log1p(Math.max(0, x.retail)),
    Math.log1p(Math.max(0, x.issueSizeCr ?? 0)),
    ofsShare,
    x.series === 'SME' ? 1 : 0,
    Math.log(pe ?? peFallback),
    pe === null ? 1 : 0,
  ];
}

/** Solves A x = b with partial-pivot Gaussian elimination. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / piv;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-12));
}

export function fitRidge(X: number[][], y: number[], lambda = 1): GmpModel {
  const n = X.length;
  const d = X[0].length;
  const means = Array.from({ length: d }, (_, j) => X.reduce((s, r) => s + r[j], 0) / n);
  const stds = Array.from({ length: d }, (_, j) => {
    const v = X.reduce((s, r) => s + (r[j] - means[j]) ** 2, 0) / n;
    return Math.sqrt(v) || 1;
  });
  const Z = X.map((r) => r.map((v, j) => (v - means[j]) / stds[j]));
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  const yc = y.map((v) => v - yMean);

  const A = Array.from({ length: d }, (_, i) =>
    Array.from({ length: d }, (_, j) => Z.reduce((s, r) => s + r[i] * r[j], 0) + (i === j ? lambda : 0))
  );
  const b = Array.from({ length: d }, (_, i) => Z.reduce((s, r, k) => s + r[i] * yc[k], 0));
  const weights = solve(A, b);

  const preds = Z.map((r) => yMean + r.reduce((s, v, j) => s + v * weights[j], 0));
  const resid = y.map((v, i) => v - preds[i]);
  const sse = resid.reduce((s, e) => s + e * e, 0);
  const sst = yc.reduce((s, e) => s + e * e, 0) || 1;
  return {
    version: `ridge-${new Date().toISOString().slice(0, 10)}-n${n}`,
    means,
    stds,
    weights,
    intercept: yMean,
    residualStd: Math.sqrt(sse / Math.max(1, n - d - 1)),
    trainedOn: n,
    metrics: {
      mae: Math.round((resid.reduce((s, e) => s + Math.abs(e), 0) / n) * 100) / 100,
      r2: Math.round((1 - sse / sst) * 1000) / 1000,
      lambda,
    },
  };
}

export function predict(model: GmpModel, x: number[]) {
  const z = x.map((v, j) => (v - model.means[j]) / model.stds[j]);
  const contributions = z.map((v, j) => v * model.weights[j]);
  const gain = model.intercept + contributions.reduce((a, b) => a + b, 0);
  const band = 1.28 * model.residualStd; // ~80% interval
  const drivers = contributions
    .map((c, j) => ({ feature: FEATURE_LABELS[FEATURES[j]], contributionPct: Math.round(c * 100) / 100 }))
    .filter((d) => d.feature !== FEATURE_LABELS.peMissing)
    .sort((a, b) => Math.abs(b.contributionPct) - Math.abs(a.contributionPct))
    .slice(0, 4);
  return {
    predictedGainPct: Math.round(gain * 100) / 100,
    lowerPct: Math.round((gain - band) * 100) / 100,
    upperPct: Math.round((gain + band) * 100) / 100,
    drivers,
  };
}

function inputsFor(r: IpoRecord, sub: { qib: number; nii: number; retail: number }): RawInputs {
  return {
    qib: sub.qib,
    nii: sub.nii,
    retail: sub.retail,
    issueSizeCr: r.issueSizeCr,
    freshIssueCr: r.freshIssueCr,
    ofsCr: r.ofsCr,
    series: r.series,
    peRatio: r.extra.peRatio ?? null,
  };
}

export async function loadLatestModel(): Promise<GmpModel | null> {
  const rows = await getDb().select().from(schema.gmpModelsTable).orderBy(desc(schema.gmpModelsTable.createdAt)).limit(1);
  return rows[0] ? (rows[0].coefficients as GmpModel) : null;
}

/** Trains on every listed IPO with a known listing price and a final subscription snapshot. */
export async function refitGmpModel(): Promise<{ trained: boolean; rows: number; version?: string; metrics?: GmpModel['metrics'] }> {
  const listed = (await IpoRepository.listAll()).filter((r) => r.status === 'Listed' && r.listingPrice && (r.issuePrice ?? r.priceHigh));
  const X: number[][] = [];
  const y: number[] = [];
  for (const r of listed) {
    const sub = await IpoRepository.latestSubscription(r.symbol);
    if (!sub || !sub.total) continue;
    const price = (r.issuePrice ?? r.priceHigh) as number;
    X.push(featureVector(inputsFor(r, sub)));
    y.push((((r.listingPrice as number) - price) / price) * 100);
  }
  if (X.length < MIN_TRAINING_ROWS) return { trained: false, rows: X.length };

  const model = fitRidge(X, y, 2);
  await getDb()
    .insert(schema.gmpModelsTable)
    .values({ version: model.version, coefficients: model, metrics: model.metrics, trainedOn: model.trainedOn })
    .onConflictDoNothing();
  return { trained: true, rows: X.length, version: model.version, metrics: model.metrics };
}

/** Writes a fresh prediction for each open/closed (pre-listing) IPO that has subscription data. */
export async function predictActiveIpos(): Promise<{ predicted: number; skipped: string | null }> {
  let model = await loadLatestModel();
  if (!model) {
    // First run: train immediately instead of waiting for the nightly refit.
    const fit = await refitGmpModel();
    if (fit.trained) model = await loadLatestModel();
  }
  if (!model) return { predicted: 0, skipped: `model not trained yet (needs ${MIN_TRAINING_ROWS}+ listed IPOs with subscription data)` };
  const active = (await IpoRepository.listAll()).filter((r) => r.status === 'Open' || r.status === 'Closed');
  let predicted = 0;
  for (const r of active) {
    const sub = await IpoRepository.latestSubscription(r.symbol);
    if (!sub) continue;
    const features = inputsFor(r, sub);
    const p = predict(model, featureVector(features));
    const price = r.issuePrice ?? r.priceHigh;
    await getDb().insert(schema.gmpPredictionsTable).values({
      symbol: r.symbol,
      modelVersion: model.version,
      predictedGainPct: p.predictedGainPct,
      predictedGmp: price ? Math.round(((p.predictedGainPct / 100) * price) * 100) / 100 : null,
      lowerPct: p.lowerPct,
      upperPct: p.upperPct,
      drivers: p.drivers,
      features,
    });
    predicted++;
  }
  return { predicted, skipped: null };
}

export async function latestPrediction(symbol: string) {
  const rows = await getDb()
    .select()
    .from(schema.gmpPredictionsTable)
    .where(eq(schema.gmpPredictionsTable.symbol, symbol.toUpperCase()))
    .orderBy(desc(schema.gmpPredictionsTable.createdAt))
    .limit(1);
  return rows[0] ?? null;
}
