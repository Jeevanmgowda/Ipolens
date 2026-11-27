import type { OfferStructure, Financials, Valuation, Overview } from './schemas';

/**
 * Deterministic, auditable scoring for the 4-factor checklist. The LLM extracts facts; this
 * code turns them into a 0-10 rating. Each factor is worth 2.5 points and explains its marks.
 */

export interface FactorScore {
  key: 'offer' | 'financials' | 'valuation' | 'drhp';
  label: string;
  score: number;
  max: 2.5;
  reasons: string[];
  metrics: Record<string, number | string | null>;
}

export interface Scorecard {
  factors: FactorScore[];
  total: number;
  verdict: 'APPLY' | 'APPLY_FOR_LISTING_GAINS' | 'AVOID';
  verdictLabel: string;
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const clamp = (n: number) => Math.max(0, Math.min(2.5, round(n)));

export function scoreOffer(o: OfferStructure, fallback?: { freshIssueCr: number | null; ofsCr: number | null }): FactorScore {
  const fresh = o.freshIssueCr ?? fallback?.freshIssueCr ?? null;
  const ofs = o.ofsCr ?? fallback?.ofsCr ?? null;
  const reasons: string[] = [];
  if (fresh === null && ofs === null) {
    return { key: 'offer', label: 'OFS vs fresh issue', score: 1, max: 2.5, reasons: ['Issue split not found in the document.'], metrics: { ofsSharePct: null } };
  }
  const total = (fresh ?? 0) + (ofs ?? 0);
  const share = total > 0 ? (ofs ?? 0) / total : 0;
  let score = share <= 0.25 ? 2.5 : share <= 0.5 ? 1.75 : share <= 0.75 ? 1 : 0.5;
  reasons.push(
    share === 0
      ? 'Entirely a fresh issue: all proceeds go to the company.'
      : `${round(share * 100, 1)}% of the issue is an offer for sale (money to existing shareholders).`
  );
  if (share > 0.5) reasons.push('Majority OFS: existing investors are cashing out, which has historically weighed on listings.');
  const promoterSelling = o.sellingShareholders.some((s) => s.type === 'promoter' || s.type === 'promoter_group');
  if (promoterSelling && share > 0.25) {
    score -= 0.25;
    reasons.push('Promoters are among the sellers.');
  }
  const debtRepay = o.objectsOfIssue.find((x) => /repay|prepay|debt|borrowing/i.test(x.purpose));
  if (debtRepay) reasons.push(`Part of the fresh issue repays debt (${debtRepay.amountCr ?? '?'} Cr).`);
  return {
    key: 'offer',
    label: 'OFS vs fresh issue',
    score: clamp(score),
    max: 2.5,
    reasons,
    metrics: { freshIssueCr: fresh, ofsCr: ofs, ofsSharePct: round(share * 100, 1) },
  };
}

export function scoreFinancials(f: Financials): FactorScore {
  const years = f.periods.filter((p) => p.isFullYear).slice(-3);
  const reasons: string[] = [];
  if (years.length < 2) {
    return { key: 'financials', label: 'Cash flow and P&L', score: 0.75, max: 2.5, reasons: ['Fewer than two full years of restated financials were found.'], metrics: {} };
  }
  const first = years[0];
  const last = years[years.length - 1];
  let score = 0;

  if (last.patCr !== null && last.patCr > 0) {
    score += 0.75;
    reasons.push(`Profitable in ${last.label} (PAT ₹${last.patCr} Cr).`);
  } else reasons.push(`Loss-making or PAT unavailable in ${last.label}.`);

  if (first.patCr !== null && last.patCr !== null && last.patCr > first.patCr) {
    score += 0.5;
    reasons.push(`PAT improved from ₹${first.patCr} Cr (${first.label}).`);
  }

  let cagr: number | null = null;
  if (first.revenueCr && last.revenueCr && first.revenueCr > 0) {
    cagr = (Math.pow(last.revenueCr / first.revenueCr, 1 / (years.length - 1)) - 1) * 100;
    if (cagr >= 15) score += 0.5;
    else if (cagr >= 5) score += 0.25;
    reasons.push(`Revenue CAGR ${round(cagr, 1)}% over ${years.length - 1} year(s).`);
    if (cagr >= 15 && (last.patCr ?? 0) <= 0) reasons.push('Sales are growing but the business is not yet profitable.');
  }

  if (last.cfoCr !== null && last.cfoCr > 0) {
    score += 0.5;
    reasons.push(`Positive operating cash flow in ${last.label} (₹${last.cfoCr} Cr).`);
  } else if (last.cfoCr !== null) reasons.push(`Negative operating cash flow in ${last.label}.`);

  const sumPat = years.reduce((s, y) => s + (y.patCr ?? 0), 0);
  const sumCfo = years.reduce((s, y) => s + (y.cfoCr ?? 0), 0);
  if (sumPat > 0 && sumCfo >= 0.7 * sumPat) {
    score += 0.25;
    reasons.push('Profits are backed by cash (cumulative CFO at least 70% of PAT).');
  } else if (sumPat > 0) reasons.push('Cash conversion is weak: operating cash flow lags reported profit.');

  const de = last.totalDebtCr !== null && last.netWorthCr ? last.totalDebtCr / last.netWorthCr : null;
  if (de !== null && de > 1.5) {
    score -= 0.25;
    reasons.push(`High leverage: debt/equity ${round(de, 2)}.`);
  }

  return {
    key: 'financials',
    label: 'Cash flow and P&L',
    score: clamp(score),
    max: 2.5,
    reasons,
    metrics: { revenueCagrPct: cagr !== null ? round(cagr, 1) : null, latestPatCr: last.patCr, latestCfoCr: last.cfoCr, debtToEquity: de !== null ? round(de, 2) : null },
  };
}

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function scoreValuation(v: Valuation, priceHigh: number | null, listedIssuePe: number | null): FactorScore {
  const reasons: string[] = [];
  const issuePe =
    v.issuePeAtUpperBand ?? (priceHigh && v.epsForPe && v.epsForPe > 0 ? priceHigh / v.epsForPe : null) ?? listedIssuePe;
  const peerMedian = median(v.peers.map((p) => p.peRatio ?? NaN));
  const metrics = { issuePe: issuePe !== null ? round(issuePe, 1) : null, peerMedianPe: peerMedian !== null ? round(peerMedian, 1) : null, premiumPct: null as number | null };

  if (issuePe === null) {
    if (v.epsForPe !== null && v.epsForPe <= 0) reasons.push('Loss-making at the EPS level: P/E is not meaningful, so the price relies on future growth.');
    else reasons.push('Issue P/E could not be computed from the document.');
    return { key: 'valuation', label: 'Valuation vs peers', score: 0.5, max: 2.5, reasons, metrics };
  }
  if (peerMedian === null) {
    reasons.push(`Issue P/E ${round(issuePe, 1)}x, but no listed peer P/E was disclosed to compare against.`);
    return { key: 'valuation', label: 'Valuation vs peers', score: 1, max: 2.5, reasons, metrics };
  }
  const premium = (issuePe / peerMedian - 1) * 100;
  metrics.premiumPct = round(premium, 1);
  const score = premium <= -20 ? 2.5 : premium <= 0 ? 2 : premium <= 25 ? 1.25 : premium <= 50 ? 0.75 : 0.25;
  reasons.push(
    `Issue P/E ${round(issuePe, 1)}x vs peer median ${round(peerMedian, 1)}x (${premium >= 0 ? '+' : ''}${round(premium, 1)}%).`
  );
  reasons.push(
    premium <= 0
      ? 'Priced at or below peers, which leaves room for upside.'
      : premium > 50
      ? 'Priced well above peers: the issue is selling a growth story.'
      : 'Priced at a premium to peers.'
  );
  return { key: 'valuation', label: 'Valuation vs peers', score: clamp(score), max: 2.5, reasons, metrics };
}

export function scoreOverview(o: Overview): FactorScore {
  const high = o.risks.filter((r) => r.severity === 'high').length;
  const medium = o.risks.filter((r) => r.severity === 'medium').length;
  let score = 2.5 - 0.4 * high - 0.15 * medium;
  const reasons = [`${high} high-severity and ${medium} medium-severity business risks identified.`];
  if (o.litigation.material) {
    score -= 0.25;
    reasons.push('Material outstanding litigation disclosed.');
  }
  if (o.customerConcentration.level === 'high') {
    score -= 0.25;
    reasons.push('High customer or supplier concentration.');
  }
  if (o.growthDrivers.length >= 2) {
    score += 0.25;
    reasons.push(`${o.growthDrivers.length} identifiable growth drivers.`);
  }
  return {
    key: 'drhp',
    label: 'DRHP risks and growth',
    score: Math.max(0.25, clamp(score)),
    max: 2.5,
    reasons,
    metrics: { highRisks: high, mediumRisks: medium, growthDrivers: o.growthDrivers.length },
  };
}

export function buildScorecard(factors: FactorScore[]): Scorecard {
  const total = round(factors.reduce((s, f) => s + f.score, 0), 1);
  const verdict = total >= 7 ? 'APPLY' : total >= 5 ? 'APPLY_FOR_LISTING_GAINS' : 'AVOID';
  return {
    factors,
    total,
    verdict,
    verdictLabel: verdict === 'APPLY' ? 'Apply (long term)' : verdict === 'APPLY_FOR_LISTING_GAINS' ? 'Apply only for listing gains / with caution' : 'Avoid',
  };
}
