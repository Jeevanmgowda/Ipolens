import { describe, it, expect } from 'vitest';
import { fitRidge, predict, featureVector } from '@/lib/services/gmp-prediction.service';

describe('AI listing-gain (GMP) model', () => {
  // Synthetic history where listing gain rises with QIB demand and falls with OFS share.
  const rows = Array.from({ length: 40 }, (_, i) => {
    const qib = (i % 10) * 15 + 1;
    const ofs = (i % 4) * 25;
    const x = featureVector({ qib, nii: qib / 2, retail: qib / 3, issueSizeCr: 500 + i * 10, freshIssueCr: 100 - ofs, ofsCr: ofs, series: i % 5 === 0 ? 'SME' : 'EQ', peRatio: 30 });
    const y = 4 * Math.log1p(qib) - 10 * (ofs / 100) + (i % 3) - 1;
    return { x, y };
  });

  it('fits and generalises the direction of the main drivers', () => {
    const model = fitRidge(rows.map((r) => r.x), rows.map((r) => r.y), 1);
    expect(model.trainedOn).toBe(40);
    expect(model.metrics.r2).toBeGreaterThan(0.8);

    const hot = predict(model, featureVector({ qib: 150, nii: 70, retail: 40, issueSizeCr: 600, freshIssueCr: 100, ofsCr: 0, series: 'EQ', peRatio: 30 }));
    const cold = predict(model, featureVector({ qib: 1, nii: 0.5, retail: 0.3, issueSizeCr: 600, freshIssueCr: 25, ofsCr: 75, series: 'EQ', peRatio: 30 }));
    expect(hot.predictedGainPct).toBeGreaterThan(cold.predictedGainPct);
    expect(hot.lowerPct).toBeLessThan(hot.predictedGainPct);
    expect(hot.upperPct).toBeGreaterThan(hot.predictedGainPct);
    expect(hot.drivers[0].feature).toBeTruthy();
  });

  it('marks a missing P/E explicitly instead of inventing one', () => {
    const v = featureVector({ qib: 1, nii: 1, retail: 1, issueSizeCr: 100, freshIssueCr: 100, ofsCr: 0, series: 'EQ', peRatio: null });
    expect(v[v.length - 1]).toBe(1);
  });
});
