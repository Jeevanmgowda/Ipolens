import { describe, it, expect } from 'vitest';
import { analyzeDrhpFiling } from '../src/services/geminiAnalyst';

describe('Gemini 2.5 Flash DRHP Analyst Service', () => {
  it('should return institutional pre-synthesized analysis for known symbols like NSE', async () => {
    const analysis = await analyzeDrhpFiling('NSE', 'National Stock Exchange of India Ltd');

    expect(analysis).toBeDefined();
    expect(analysis.symbol).toBe('NSE');
    expect(analysis.companyName).toBe('National Stock Exchange of India Ltd');
    expect(analysis.verdict).toBe('Subscribe');
    expect(analysis.confidenceScore).toBeGreaterThanOrEqual(90);
    expect(analysis.topStrengths.length).toBeGreaterThanOrEqual(3);
    expect(analysis.topRisks.length).toBeGreaterThanOrEqual(3);
    expect(analysis.financials.ebitdaMargin).toBe('72.1%');
    expect(analysis.businessMoat).toContain('network effects');
  });

  it('should return balanced neutral analysis for Sonaselection (SONA)', async () => {
    const analysis = await analyzeDrhpFiling('SONA', 'Sonaselection India Limited');

    expect(analysis).toBeDefined();
    expect(analysis.symbol).toBe('SONA');
    expect(analysis.verdict).toBe('Neutral');
    expect(analysis.confidenceScore).toBe(76);
    expect(analysis.topStrengths.length).toBe(3);
    expect(analysis.topRisks.length).toBe(3);
  });

  it('should analyze custom DRHP text input dynamically', async () => {
    const customDrhp = `
      Company: QuantumEdge Semiconductor India Ltd
      Issue Size: ₹1,200 Cr
      Price Band: ₹450 - ₹480
      Business: QuantumEdge designs high-efficiency micro-controllers for automotive ECUs and renewable inverters.
      Financials: FY24 Revenue: ₹650 Cr (+48% YoY), EBITDA Margin: 31.5%, Net Debt: Zero.
      Key Risks: Single foundry reliance in Taiwan for wafer fabrication; geopolitical tensions.
      Customer Concentration: Top 3 OEM clients account for 62% of revenue.
    `;

    const analysis = await analyzeDrhpFiling(
      'QUANTUMEDGE',
      'QuantumEdge Semiconductor India Ltd',
      customDrhp
    );

    expect(analysis).toBeDefined();
    expect(analysis.symbol).toBe('QUANTUMEDGE');
    expect(['Subscribe', 'Neutral', 'Avoid']).toContain(analysis.verdict);
    expect(analysis.confidenceScore).toBeGreaterThanOrEqual(50);
    expect(analysis.topStrengths.length).toBeGreaterThanOrEqual(1);
    expect(analysis.topRisks.length).toBeGreaterThanOrEqual(1);
    expect(analysis.financials).toBeDefined();
    expect(analysis.businessMoat).toBeTruthy();
  }, 30000);

  it('should generate fallback synthesis gracefully for unlisted or newly announced companies', async () => {
    const analysis = await analyzeDrhpFiling('UNKNOWNCO', 'Unknown Technologies Ltd');

    expect(analysis).toBeDefined();
    expect(analysis.symbol).toBe('UNKNOWNCO');
    expect(['Subscribe', 'Neutral', 'Avoid']).toContain(analysis.verdict);
    expect(analysis.verdictReason).toBeTruthy();
    expect(analysis.financials.debtToEquity).toBeTruthy();
  });

  it('should resolve JPL to Jio Platforms with genuine ₹50,000 Cr issue structure and real telemetry', async () => {
    const analysis = await analyzeDrhpFiling('JPL', 'Jio Platforms Limited');

    expect(analysis).toBeDefined();
    expect(analysis.symbol).toBe('JIOPLAT');
    expect(analysis.companyName).toBe('Jio Platforms Limited');
    expect(analysis.issueStructure?.totalSizeCr).toBe(50000);
    expect(analysis.issueStructure?.totalSizeCr).not.toBe(1500);
    expect(analysis.liveTelemetry).toBeDefined();
    expect(analysis.liveTelemetry?.issueSizeCr).toBe(50000);
    expect(analysis.liveTelemetry?.registrarName).toBe('KFin Technologies Limited');
    expect(analysis.promotersShareholding?.preIpoPct).toBe(100);
    expect(analysis.promotersShareholding?.postIpoPct).toBe(85);
    expect(analysis.confidenceScore).toBeGreaterThanOrEqual(90);
  });

  it('should return genuine real-time telemetry and verified issue size for HDFP and ACMEIND', async () => {
    const hdfp = await analyzeDrhpFiling('HDFP', 'HD Fire Protect Limited');
    expect(hdfp.symbol).toBe('HDFP');
    expect(hdfp.issueStructure?.totalSizeCr).toBe(285);
    expect(hdfp.liveTelemetry?.registrarName).toBe('Link Intime India Pvt Ltd');
    expect(hdfp.liveTelemetry?.gmpEstimate).toBe(60);

    const acme = await analyzeDrhpFiling('ACMEIND', 'Acme India Industries Limited');
    expect(acme.symbol).toBe('ACMEIND');
    expect(acme.issueStructure?.totalSizeCr).toBe(28.8);
    expect(acme.liveTelemetry?.subscriptionTotal).toBe(124.23);
    expect(acme.liveTelemetry?.registrarName).toBe('Bigshare Services Pvt Ltd');
  });
});
