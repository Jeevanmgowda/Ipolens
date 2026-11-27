import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tagSections, chunkPages, detectSectionStart } from '@/lib/services/drhp/document-parsing';
import { scoreOffer, scoreFinancials, scoreValuation, scoreOverview, buildScorecard, median } from '@/lib/services/drhp/scoring';
import type { Financials, OfferStructure, Overview, Valuation } from '@/lib/services/drhp/schemas';
import { createTestDatabase } from './helpers/testDb';
import { seedIpo, seedUser } from './helpers/seed';

// Gemini is mocked: deterministic embeddings and canned *extractions* (the LLM's job), so the test
// exercises retrieval, persistence and the deterministic scoring end to end without network calls.
vi.mock('@/lib/services/drhp/gemini', () => {
  const vec = (text: string) => {
    const v = new Array(768).fill(0);
    for (const w of text.toLowerCase().split(/\W+/)) if (w) v[(w.charCodeAt(0) * 31 + w.length) % 768] += 1;
    const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / n);
  };
  return {
    EMBEDDING_DIMENSIONS: 768,
    embedTexts: vi.fn(async (texts: string[]) => texts.map(vec)),
    generateJson: vi.fn(async ({ prompt }: { prompt: string }) => {
      if (prompt.startsWith('Extract the offer structure')) {
        return { freshIssueCr: 300, ofsCr: 700, totalIssueCr: 1000, freshIssueShares: null, ofsShares: null, sellingShareholders: [{ name: 'Promoter A', type: 'promoter', detail: '1 cr shares' }], objectsOfIssue: [{ purpose: 'Repayment of borrowings', amountCr: 200 }], notes: 'Mostly OFS', citations: [3] };
      }
      if (prompt.startsWith('Extract restated financial')) {
        return { unit: 'INR crore', periods: [
          { label: 'FY2024', isFullYear: true, revenueCr: 500, ebitdaCr: 80, patCr: 40, cfoCr: 45, totalDebtCr: 100, netWorthCr: 300, ronwPct: 13, epsBasic: 4 },
          { label: 'FY2025', isFullYear: true, revenueCr: 600, ebitdaCr: 100, patCr: 55, cfoCr: 50, totalDebtCr: 90, netWorthCr: 350, ronwPct: 15.7, epsBasic: 5 },
          { label: 'FY2026', isFullYear: true, revenueCr: 750, ebitdaCr: 130, patCr: 75, cfoCr: 70, totalDebtCr: 80, netWorthCr: 420, ronwPct: 17.8, epsBasic: 5 },
        ], notes: '', citations: [5, 6] };
      }
      if (prompt.startsWith('From the "Basis for Offer Price"')) {
        return { epsForPe: 5, issuePeAtUpperBand: null, peers: [{ name: 'Peer 1', peRatio: 25, ronwPct: 14, revenueCr: 900 }, { name: 'Peer 2', peRatio: 15, ronwPct: 12, revenueCr: 700 }], notes: '', citations: [7] };
      }
      if (prompt.startsWith('Summarise the business')) {
        return { businessSummary: 'Makes widgets.', risks: [{ title: 'Customer concentration', detail: 'Top 5 = 60%', severity: 'high', page: 2 }], growthDrivers: [{ title: 'Exports', detail: 'x', page: 4 }, { title: 'Capacity', detail: 'y', page: 4 }], litigation: { material: false, summary: 'None material', page: null }, customerConcentration: { level: 'high', summary: 'Top 5 = 60%', page: 2 }, citations: [2, 4] };
      }
      if (prompt.startsWith('QUESTION:')) return { found: true, answer: 'Proceeds repay debt (p. 3).', pages: [3] };
      return { summary: 'Fair business, majority OFS, priced at a premium.', pros: [{ point: 'Growing profits', page: 6 }], cons: [{ point: 'Mostly OFS', page: 3 }] };
    }),
  };
});

const filler = (topic: string) => `${topic} `.repeat(120);
const PAGES = [
  'DRAFT RED HERRING PROSPECTUS\nTest IPO Limited\n' + filler('cover summary'),
  'RISK FACTORS\n' + filler('risk customer concentration top five customers revenue'),
  'THE OFFER\n' + filler('fresh issue offer for sale selling shareholders promoter aggregating crore'),
  'OUR BUSINESS\n' + filler('our strengths exports capacity growth'),
  'RESTATED FINANCIAL INFORMATION\n' + filler('revenue from operations profit after tax'),
  filler('net cash generated from operating activities borrowings net worth'),
  'BASIS FOR OFFER PRICE\n' + filler('price earnings ratio comparison with listed industry peers EPS'),
];

describe('DRHP parsing', () => {
  it('detects chapter headings but ignores a table of contents page', () => {
    expect(detectSectionStart('RISK FACTORS\nSome text')).toBe('risk_factors');
    expect(detectSectionStart('TABLE OF CONTENTS\nRISK FACTORS\nTHE OFFER\nCAPITAL STRUCTURE\nOBJECTS OF THE OFFER\n')).toBeNull();
  });

  it('carries sections across pages and chunks within sections with real page numbers', () => {
    const tagged = tagSections(PAGES);
    expect(tagged[5].section).toBe('financial_statements'); // continuation page
    const chunks = chunkPages(tagged, 150, 30);
    expect(chunks.length).toBeGreaterThan(PAGES.length);
    for (const c of chunks) {
      expect(c.pageEnd).toBeGreaterThanOrEqual(c.pageStart);
      expect(tagged[c.pageStart - 1].section).toBe(c.section);
    }
  });
});

describe('Deterministic 4-factor scoring', () => {
  const offer = (fresh: number, ofs: number): OfferStructure => ({ freshIssueCr: fresh, ofsCr: ofs, totalIssueCr: fresh + ofs, freshIssueShares: null, ofsShares: null, sellingShareholders: [], objectsOfIssue: [], notes: '', citations: [] });

  it('penalises a majority offer for sale', () => {
    expect(scoreOffer(offer(1000, 0)).score).toBe(2.5);
    expect(scoreOffer(offer(300, 700)).score).toBe(1);
    expect(scoreOffer(offer(100, 900)).score).toBe(0.5);
  });

  it('flags growth without profit', () => {
    const f: Financials = { unit: 'INR crore', notes: '', citations: [], periods: [
      { label: 'FY24', isFullYear: true, revenueCr: 100, ebitdaCr: -20, patCr: -30, cfoCr: -25, totalDebtCr: 10, netWorthCr: 50, ronwPct: null, epsBasic: -2 },
      { label: 'FY25', isFullYear: true, revenueCr: 200, ebitdaCr: -10, patCr: -20, cfoCr: -15, totalDebtCr: 10, netWorthCr: 40, ronwPct: null, epsBasic: -1 },
    ] };
    const s = scoreFinancials(f);
    expect(s.score).toBeLessThan(1.5);
    expect(s.reasons.join(' ')).toMatch(/not yet profitable/);
  });

  it('scores valuation against the peer median', () => {
    const v = (peers: number[]): Valuation => ({ epsForPe: 5, issuePeAtUpperBand: null, peers: peers.map((p, i) => ({ name: `P${i}`, peRatio: p, ronwPct: null, revenueCr: null })), notes: '', citations: [] });
    expect(median([10, 30, 20])).toBe(20);
    expect(scoreValuation(v([30, 40]), 100, null).score).toBe(2.5); // 20x vs 35x
    expect(scoreValuation(v([10]), 100, null).score).toBe(0.25); // 20x vs 10x
    expect(scoreValuation(v([]), 100, null).score).toBe(1); // no peers disclosed
    expect(scoreValuation({ ...v([20]), epsForPe: -1 }, 100, null).score).toBe(0.5); // loss-making
  });

  it('builds a rating out of 10 with a verdict', () => {
    const overview: Overview = { businessSummary: '', risks: [], growthDrivers: [], litigation: { material: false, summary: '', page: null }, customerConcentration: { level: 'low', summary: '', page: null }, citations: [] };
    const card = buildScorecard([scoreOffer(offer(1000, 0)), { ...scoreOverview(overview) }, scoreOverview(overview), scoreOverview(overview)]);
    expect(card.total).toBeLessThanOrEqual(10);
    expect(card.verdict).toBe('APPLY');
  });
});

describe('DRHP analyst end to end (PGlite + pgvector, Gemini mocked)', () => {
  let close: () => Promise<void>;
  beforeEach(async () => {
    ({ close } = await createTestDatabase());
  });
  afterEach(async () => close());

  it('indexes pages, retrieves with hybrid search, scores and answers with citations', async () => {
    const { id: userId } = await seedUser();
    await seedIpo();
    const { getDb, schema } = await import('@/db');
    const { indexDocument } = await import('@/lib/services/drhp/document.service');
    const { analyzeDocument, askDocument } = await import('@/lib/services/drhp/analyst.service');

    await getDb().insert(schema.drhpDocumentsTable).values({ id: 'doc1', userId, symbol: 'TESTIPO', sha256: 'x'.repeat(64), pageCount: PAGES.length });
    await getDb().insert(schema.drhpPagesTable).values(PAGES.map((text, i) => ({ documentId: 'doc1', pageNumber: i + 1, text })));

    const { chunks } = await indexDocument('doc1');
    expect(chunks).toBeGreaterThan(0);

    const result = await analyzeDocument('doc1');
    const byKey = Object.fromEntries(result.scorecard.factors.map((f) => [f.key, f]));
    expect(byKey.offer.metrics.ofsSharePct).toBe(70);
    expect(byKey.valuation.metrics.issuePe).toBe(20); // price 100 / EPS 5
    expect(byKey.valuation.metrics.peerMedianPe).toBe(20);
    expect(result.scorecard.total).toBeGreaterThan(0);
    expect(result.scorecard.total).toBeLessThanOrEqual(10);
    expect(result.disclaimer).toMatch(/not investment advice/);

    const answer = await askDocument('doc1', 'How will the proceeds be used?');
    expect(answer.found).toBe(true);
    expect(answer.sources.length).toBeGreaterThan(0);
  });
});
