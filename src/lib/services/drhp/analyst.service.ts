import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { env } from '@/lib/env';
import { IpoRepository } from '@/lib/repositories/ipo.repository';
import { NotFoundError, BadRequestError } from '@/lib/http';
import { generateJson } from './gemini';
import { retrieveMany, formatContext } from './retriever';
import { getDocument } from './document.service';
import type { DrhpSection } from './document-parsing';
import {
  OfferStructureSchema,
  FinancialsSchema,
  ValuationSchema,
  OverviewSchema,
  NarrativeSchema,
  AnswerSchema,
  type OfferStructure,
  type Financials,
  type Valuation,
  type Overview,
  type Narrative,
} from './schemas';
import { scoreOffer, scoreFinancials, scoreValuation, scoreOverview, buildScorecard, type Scorecard } from './scoring';

/**
 * DRHP analyst: the 4-factor IPO checklist.
 *  1. OFS vs fresh issue   2. Cash flow & P&L (3 years)   3. Valuation vs listed peers
 *  4. DRHP risks & growth. Facts come from retrieved, page-cited DRHP excerpts; the rating out
 *  of 10 is computed deterministically (scoring.ts), and the LLM only writes the narrative.
 */

export const DISCLAIMER =
  'Educational analysis generated from the offer document. It is not investment advice or a recommendation to buy or sell securities.';

const EXTRACTION_SYSTEM = [
  'You extract facts from an Indian IPO offer document (DRHP/RHP) for an equity research checklist.',
  'Use ONLY the provided excerpts. Each excerpt starts with a header showing its physical PDF page numbers; cite those numbers.',
  'If a value is not present in the excerpts, return null. Never estimate or invent figures.',
  'Convert all amounts to INR crore (1 crore = 100 lakh = 10 million). Losses and negative cash flows are negative numbers.',
].join(' ');

export interface DrhpAnalysisResult {
  documentId: string;
  symbol: string | null;
  companyName: string | null;
  generatedAt: string;
  model: string;
  scorecard: Scorecard;
  offer: OfferStructure;
  financials: Financials;
  valuation: Valuation & { issuePriceUsed: number | null };
  overview: Overview;
  narrative: Narrative;
  disclaimer: string;
}

async function extract<T extends import('zod').ZodTypeAny>(
  documentId: string,
  schemaDef: T,
  task: string,
  queries: string[],
  sections: DrhpSection[]
) {
  const chunks = await retrieveMany(documentId, queries, { sections, maxChunks: 14 });
  if (!chunks.length) {
    // Section detection can miss on unusual layouts; retry over the whole document.
    const all = await retrieveMany(documentId, queries, { maxChunks: 14 });
    chunks.push(...all);
  }
  return generateJson({
    schema: schemaDef,
    system: EXTRACTION_SYSTEM,
    prompt: `${task}\n\nEXCERPTS:\n\n${formatContext(chunks)}`,
  });
}

export async function analyzeDocument(documentId: string): Promise<DrhpAnalysisResult> {
  const doc = await getDocument(documentId);
  if (!doc) throw new NotFoundError('Document not found.');
  if (doc.status !== 'READY') throw new BadRequestError(`Document is not indexed yet (status ${doc.status}).`);
  const ipo = doc.symbol ? await IpoRepository.getBySymbol(doc.symbol) : null;
  const model = env().GEMINI_ANALYSIS_MODEL;

  const [offer, financials, valuation, overview] = await Promise.all([
    extract(
      documentId,
      OfferStructureSchema,
      'Extract the offer structure: fresh issue and offer-for-sale sizes, the selling shareholders (marking promoters), and the objects of the issue with amounts.',
      ['offer for sale fresh issue aggregating crore', 'selling shareholders promoter selling shareholder', 'objects of the offer net proceeds utilisation'],
      ['cover', 'the_offer', 'capital_structure', 'objects_of_offer']
    ),
    extract(
      documentId,
      FinancialsSchema,
      'Extract restated financial figures for the last three full financial years (and the latest stub period if given): revenue from operations, EBITDA, profit after tax, net cash from operating activities, total borrowings, net worth, RoNW and basic EPS.',
      [
        'restated summary statement of profit and loss revenue from operations profit after tax',
        'net cash generated from operating activities cash flow',
        'total borrowings net worth return on net worth',
        'key performance indicators EBITDA margin',
      ],
      ['cover', 'financial_statements', 'mdna', 'basis_for_offer_price']
    ),
    extract(
      documentId,
      ValuationSchema,
      'From the "Basis for Offer Price" chapter extract: basic EPS for the latest financial year, the P/E at the upper end of the price band if stated, and the comparison with listed industry peers (name, P/E, RoNW, revenue).',
      ['basis for offer price price earnings ratio P/E', 'comparison with listed industry peers', 'basic and diluted earnings per share EPS'],
      ['basis_for_offer_price']
    ),
    extract(
      documentId,
      OverviewSchema,
      'Summarise the business, the most significant business risks (rate severity), growth opportunities, material litigation and customer/supplier concentration. Cite a page for each item.',
      [
        'internal risk factors business could be adversely affected',
        'dependence on top customers suppliers concentration revenue',
        'outstanding litigation material criminal proceedings tax',
        'our strengths strategies growth opportunity industry',
      ],
      ['risk_factors', 'our_business', 'industry_overview', 'litigation', 'cover']
    ),
  ]);

  const priceHigh = ipo?.priceHigh ?? null;
  const scorecard = buildScorecard([
    scoreOffer(offer, ipo ? { freshIssueCr: ipo.freshIssueCr, ofsCr: ipo.ofsCr } : undefined),
    scoreFinancials(financials),
    scoreValuation(valuation, priceHigh, ipo?.extra.peRatio ?? null),
    scoreOverview(overview),
  ]);

  const narrative = await generateJson({
    schema: NarrativeSchema,
    model,
    system:
      'You are a careful Indian equity research writer. Explain an IPO checklist result to a retail investor in plain English. ' +
      'Use only the facts provided. Do not change the score or give personalised advice.',
    prompt: JSON.stringify({
      company: doc.companyName || ipo?.companyName || doc.symbol,
      score: scorecard.total,
      verdict: scorecard.verdictLabel,
      factors: scorecard.factors.map((f) => ({ factor: f.label, score: f.score, reasons: f.reasons })),
      offer,
      financials,
      valuation,
      risks: overview.risks,
      growthDrivers: overview.growthDrivers,
    }),
  });

  const result: DrhpAnalysisResult = {
    documentId,
    symbol: doc.symbol,
    companyName: doc.companyName || ipo?.companyName || null,
    generatedAt: new Date().toISOString(),
    model,
    scorecard,
    offer,
    financials,
    valuation: { ...valuation, issuePriceUsed: priceHigh },
    overview,
    narrative,
    disclaimer: DISCLAIMER,
  };
  return result;
}

/** Runs and persists an analysis (RUNNING -> READY/FAILED). */
export async function runAndStoreAnalysis(documentId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .insert(schema.drhpAnalysesTable)
    .values({ documentId, model: env().GEMINI_ANALYSIS_MODEL, status: 'RUNNING' })
    .returning({ id: schema.drhpAnalysesTable.id });
  try {
    const result = await analyzeDocument(documentId);
    await db
      .update(schema.drhpAnalysesTable)
      .set({ status: 'READY', result, updatedAt: new Date() })
      .where(eq(schema.drhpAnalysesTable.id, row.id));
  } catch (err) {
    await db
      .update(schema.drhpAnalysesTable)
      .set({ status: 'FAILED', error: (err as Error).message.slice(0, 1000), updatedAt: new Date() })
      .where(eq(schema.drhpAnalysesTable.id, row.id));
    throw err;
  }
  return row.id;
}

export async function latestAnalysis(documentId: string) {
  const rows = await getDb()
    .select()
    .from(schema.drhpAnalysesTable)
    .where(eq(schema.drhpAnalysesTable.documentId, documentId))
    .orderBy(desc(schema.drhpAnalysesTable.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/** Grounded Q&A: answers only from retrieved excerpts, with page citations. */
export async function askDocument(documentId: string, question: string) {
  const doc = await getDocument(documentId);
  if (!doc) throw new NotFoundError('Document not found.');
  if (doc.status !== 'READY') throw new BadRequestError('Document is still being indexed.');
  const chunks = await retrieveMany(documentId, [question], { kPerQuery: 8, maxChunks: 8 });
  const answer = await generateJson({
    schema: AnswerSchema,
    model: env().GEMINI_FAST_MODEL,
    system:
      'Answer questions about an Indian IPO offer document using ONLY the excerpts. Cite the page numbers from the excerpt headers. ' +
      'If the excerpts do not contain the answer, set found=false and say so. Be concise (2-5 sentences). No investment advice.',
    prompt: `QUESTION: ${question}\n\nEXCERPTS:\n\n${formatContext(chunks)}`,
  });
  return {
    ...answer,
    sources: chunks.map((c) => ({ pageStart: c.pageStart, pageEnd: c.pageEnd, section: c.section, excerpt: c.content.slice(0, 400) })),
  };
}
