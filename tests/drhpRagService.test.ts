import { describe, it, expect } from 'vitest';
import { drhpRagService } from '../src/lib/services/drhp-rag.service';
import { answerDrhpQuestion, analyzeDrhpFiling } from '../src/services/geminiAnalyst';

describe('DRHP RAG Model & Prospectus Ingestion Pipeline', () => {
  it('should tokenize text and filter common stop words while keeping financial tokens', () => {
    const tokens = drhpRagService.tokenize('The total revenue grew at 42.5% CAGR with ₹280 Cr EBITDA in FY24');
    expect(tokens).toContain('revenue');
    expect(tokens).toContain('42.5%');
    expect(tokens).toContain('cagr');
    expect(tokens).toContain('₹280');
    expect(tokens).toContain('ebitda');
    expect(tokens).toContain('fy24');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('with');
  });

  it('should expand queries with domain-specific financial synonyms', () => {
    const expanded = drhpRagService.expandQuery('What is the debt of the company?');
    expect(expanded).toContain('debt');
    expect(expanded).toContain('borrowings');
    expect(expanded).toContain('loans');
    expect(expanded).toContain('leverage');
  });

  it('should retrieve relevant grounded chunks with page numbers for pre-indexed IPO (JIOPLAT)', () => {
    const chunks = drhpRagService.retrieveChunks('JIOPLAT', 'objects of the issue 5g capex', 3);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].section).toBe('Objects of the Offer');
    expect(chunks[0].pageNumber).toBe(42);
    expect(chunks[0].score).toBeGreaterThan(0.5);
    expect(chunks[0].snippet).toContain('5G');
  });

  it('should retrieve promoter shareholding chunks for SWIGGY', () => {
    const chunks = drhpRagService.retrieveChunks('SWIGGY', 'promoter shareholding prosus ofs', 3);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].section).toBe('Capital Structure & Major Shareholders');
    expect(chunks[0].snippet).toContain('Prosus');
  });

  it('should dynamically index arbitrary raw DRHP text and retrieve corresponding chunks', () => {
    const customText = `
      CHAPTER 1: OBJECTS OF THE OFFER
      The fresh issue proceeds of ₹500 Cr shall be utilized towards constructing a semiconductor cleanroom in Dholera (₹350 Cr) and general corporate purposes (₹150 Cr).
      
      CHAPTER 2: PROMOTER HOLDINGS AND DILUTION
      The promoter group holds 92% pre-issue equity shares. Post-IPO dilution will reduce holding to 74.5%, retaining strategic majority voting power.
      
      CHAPTER 3: LITIGATION
      The company has zero criminal proceedings and a single pending direct tax appeal of ₹4.2 Cr before CIT(A).
    `;

    drhpRagService.indexDocument('SEMICOMP', customText, 'SEMICOMP_Prospectus.pdf');
    const retrieved = drhpRagService.retrieveChunks('SEMICOMP', 'cleanroom semiconductor dholera', 2);

    expect(retrieved.length).toBeGreaterThan(0);
    expect(retrieved[0].snippet).toContain('semiconductor cleanroom');
    expect(retrieved[0].pageNumber).toBeGreaterThanOrEqual(1);
  });

  it('should answer grounded questions via queryRag with citations and retrieved chunks', async () => {
    const result = await drhpRagService.queryRag('JIOPLAT', 'What is the promoter holding and lock-in period?');
    expect(result.question).toContain('promoter holding');
    expect(result.answer).toBeDefined();
    expect(result.pageCitations.length).toBeGreaterThan(0);
    expect(result.retrievedChunks.length).toBeGreaterThan(0);
    expect(result.retrievedChunks[0].score).toBeGreaterThan(0);
  });

  it('should provide a SEBI Forensic Risk Matrix with 5 critical risk dimensions', () => {
    const matrix = drhpRagService.getForensicRiskMatrix('JIOPLAT');
    expect(matrix.length).toBeGreaterThanOrEqual(5);

    const categories = matrix.map((m) => m.category);
    expect(categories).toContain('Customer Concentration');
    expect(categories).toContain('Promoter Dilution & OFS Exit');
    expect(categories).toContain('Debt & Financial Leverage');
    expect(categories).toContain('Litigations & Regulatory Notices');
    expect(categories).toContain('Valuation vs Telecom Sector');

    for (const item of matrix) {
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(item.rating);
      expect(item.score).toBeGreaterThanOrEqual(0);
      expect(item.score).toBeLessThanOrEqual(100);
      expect(item.detail).toBeDefined();
    }
  });

  it('should provide structured DRHP chapter table of contents', () => {
    const sections = drhpRagService.getDrhpSections('JIOPLAT');
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBeDefined();
    expect(sections[0].pageRange).toBeDefined();
    expect(sections[0].keyFindings.length).toBeGreaterThan(0);
  });

  it('should integrate seamlessly through geminiAnalyst analyzeDrhpFiling and answerDrhpQuestion', async () => {
    const analysis = await analyzeDrhpFiling('JIOPLAT', 'Jio Platforms Limited');
    expect(analysis.symbol).toBe('JIOPLAT');
    expect(analysis.ragIndexReady).toBe(true);
    expect(analysis.sections).toBeDefined();
    expect(analysis.forensicRiskMatrix).toBeDefined();
    expect(analysis.forensicRiskMatrix?.length).toBeGreaterThanOrEqual(5);

    const qa = await answerDrhpQuestion('JIOPLAT', 'What are the objects of the issue?');
    expect(qa.question).toContain('objects of the issue');
    expect(qa.answer).toBeDefined();
    expect(qa.pageCitations.length).toBeGreaterThan(0);
    expect(qa.retrievedChunks).toBeDefined();
    expect(qa.retrievedChunks!.length).toBeGreaterThan(0);
  });

  it('should retrieve authentic grounded prospectus chunks for ESDS Software Solution Limited', () => {
    const capexChunks = drhpRagService.retrieveChunks('ESDS', 'objects of the issue cloud hardware capex', 2);
    expect(capexChunks.length).toBeGreaterThan(0);
    expect(capexChunks.some((c) => c.pageNumber === 74)).toBe(true);
    const chunk74 = capexChunks.find((c) => c.pageNumber === 74)!;
    expect(chunk74.snippet).toContain('cloud computing hardware');
    expect(chunk74.snippet).toContain('Nashik');

    const promoterChunks = drhpRagService.retrieveChunks('ESDS', 'promoter piyush somani shareholding', 2);
    expect(promoterChunks.length).toBeGreaterThan(0);
    expect(promoterChunks[0].pageNumber).toBe(96);
    expect(promoterChunks[0].snippet).toContain('Piyush Somani');
  });

  it('should retrieve authentic grounded prospectus chunks for SHREESIDHI', () => {
    const chunks = drhpRagService.retrieveChunks('SHREESIDHI', 'biomass briquetting solar power mehsana', 2);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].pageNumber).toBe(32);
    expect(chunks[0].snippet).toContain('Mehsana, Gujarat');
  });

  it('should generate authentic analysis with clamped conviction score and real citations for ESDS', async () => {
    const analysis = await analyzeDrhpFiling('ESDS', 'ESDS Software Solution Limited');
    expect(analysis.symbol).toBe('ESDS');
    expect(analysis.companyName).toBe('ESDS Software Solution Limited');
    expect(analysis.confidenceScore).toBeGreaterThanOrEqual(10);
    expect(analysis.confidenceScore).toBeLessThanOrEqual(100);
    expect(analysis.confidenceScore).not.toBe(125);
    expect(analysis.citations).toBeDefined();
    expect(analysis.citations.length).toBeGreaterThan(0);

    // Citations should use real grounded pages (e.g. 74, 96, 38)
    const pageNumbers = analysis.citations.map((c) => c.pageNumber);
    expect(pageNumbers.some((p) => p === 74 || p === 96 || p === 38 || p === 134 || p === 185 || p === 248)).toBe(true);

    // Business moat should be grounded in ESDS cloud & data center architecture
    expect(analysis.businessMoat).toContain('data center');
  });

  it('should ensure non-hardcoded DRHP citations and documents for any arbitrary ticker', () => {
    const citations = drhpRagService.getGroundedCitations('RANDOMTECH', 3);
    expect(citations.length).toBeGreaterThan(0);
    for (const c of citations) {
      expect(c.claim).toBeDefined();
      expect(c.pageNumber).toBeGreaterThan(0);
      expect(c.excerpt.length).toBeGreaterThan(20);
    }
  });
});
