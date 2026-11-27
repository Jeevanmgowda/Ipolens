import { z } from 'zod';

/**
 * Structured extraction schemas for the 4-factor IPO checklist. Every figure is nullable (the
 * model must not invent values) and every block carries the DRHP pages it was read from.
 */

const pages = z.array(z.number().int().positive()).describe('Physical PDF page numbers the facts were taken from');
const num = z.number().nullable();

export const OfferStructureSchema = z.object({
  freshIssueCr: num.describe('Fresh issue size in INR crore, null if not stated'),
  ofsCr: num.describe('Offer for sale size in INR crore, null if not stated'),
  totalIssueCr: num,
  freshIssueShares: num,
  ofsShares: num,
  sellingShareholders: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(['promoter', 'promoter_group', 'investor', 'other']),
        detail: z.string().describe('Shares or amount offered as written in the DRHP'),
      })
    )
    .max(25),
  objectsOfIssue: z.array(z.object({ purpose: z.string(), amountCr: num })).max(15),
  notes: z.string().describe('One or two sentences on who receives the money'),
  citations: pages,
});
export type OfferStructure = z.infer<typeof OfferStructureSchema>;

export const FinancialsSchema = z.object({
  unit: z.string().describe('Unit the figures were converted to; always "INR crore"'),
  periods: z
    .array(
      z.object({
        label: z.string().describe('e.g. "FY2025" or "6M Sep-2025"'),
        isFullYear: z.boolean(),
        revenueCr: num.describe('Revenue from operations'),
        ebitdaCr: num,
        patCr: num.describe('Restated profit after tax (negative for a loss)'),
        cfoCr: num.describe('Net cash from operating activities'),
        totalDebtCr: num.describe('Total borrowings'),
        netWorthCr: num,
        ronwPct: num,
        epsBasic: num.describe('Basic EPS in INR'),
      })
    )
    .max(6),
  notes: z.string(),
  citations: pages,
});
export type Financials = z.infer<typeof FinancialsSchema>;

export const ValuationSchema = z.object({
  epsForPe: num.describe('Basic EPS of the latest full financial year used for the P/E in "Basis for Offer Price"'),
  issuePeAtUpperBand: num.describe('P/E at the upper price band if the DRHP/RHP states it'),
  peers: z
    .array(z.object({ name: z.string(), peRatio: num, ronwPct: num, revenueCr: num }))
    .max(10)
    .describe('Listed peers from the "Basis for Offer Price" comparison table'),
  notes: z.string(),
  citations: pages,
});
export type Valuation = z.infer<typeof ValuationSchema>;

export const OverviewSchema = z.object({
  businessSummary: z.string().describe('What the company does, in 2-3 sentences'),
  risks: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        severity: z.enum(['high', 'medium', 'low']),
        page: z.number().int().positive(),
      })
    )
    .max(8),
  growthDrivers: z.array(z.object({ title: z.string(), detail: z.string(), page: z.number().int().positive() })).max(6),
  litigation: z.object({ material: z.boolean(), summary: z.string(), page: z.number().int().positive().nullable() }),
  customerConcentration: z.object({
    level: z.enum(['high', 'medium', 'low', 'unknown']),
    summary: z.string(),
    page: z.number().int().positive().nullable(),
  }),
  citations: pages,
});
export type Overview = z.infer<typeof OverviewSchema>;

export const NarrativeSchema = z.object({
  summary: z.string().describe('3-4 sentence plain-English verdict rationale'),
  pros: z.array(z.object({ point: z.string(), page: z.number().int().positive().nullable() })).max(6),
  cons: z.array(z.object({ point: z.string(), page: z.number().int().positive().nullable() })).max(6),
});
export type Narrative = z.infer<typeof NarrativeSchema>;

export const AnswerSchema = z.object({
  found: z.boolean().describe('false when the excerpts do not contain the answer'),
  answer: z.string(),
  pages: z.array(z.number().int().positive()),
});
export type Answer = z.infer<typeof AnswerSchema>;
