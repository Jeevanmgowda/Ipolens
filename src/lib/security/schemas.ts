import { z } from 'zod';
import { MAX_QUESTION_CHARS } from '@/lib/security/promptSafety';

/** Shared request-field schemas (docs/security/AUDIT_2026-11-27.md, M5). */

export const SymbolSchema = z
  .string()
  .trim()
  .min(1, 'Symbol is required')
  .max(20)
  .regex(/^[A-Za-z0-9&._-]+$/, 'Invalid symbol')
  .transform((s) => s.toUpperCase());

export const CompanyNameSchema = z.string().trim().max(150);
export const QuestionSchema = z.string().trim().min(1).max(MAX_QUESTION_CHARS);

/** Pasted DRHP text: generous but bounded (≈2M characters). */
export const DrhpTextSchema = z.string().max(2_000_000);

/** Formats the first Zod issue as a short client-safe message. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  const field = issue?.path?.join('.') || 'request';
  return `Invalid ${field}: ${issue?.message || 'bad value'}`;
}

// ---- Mutating-route schemas (audit M5: explicit allowlists, enums and numeric bounds) ----

export const RecordIdSchema = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/, 'Invalid id');

export const PanInputSchema = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN must look like ABCDE1234F'));

export const RelationshipSchema = z.enum(['Self', 'Spouse', 'Parent', 'Child', 'HUF', 'Other']);
export const ApplicationStatusSchema = z.enum(['Applied', 'Mandate Approved', 'Allotted', 'Not Allotted', 'Refunded']);
export const BidCategorySchema = z.enum(['Retail', 'sNII', 'bNII', 'Employee']);

/** Holder name, PAN and relationship are deliberately absent: the server derives them from `panId`. */
export const ApplicationCreateSchema = z.object({
  ipoSymbol: SymbolSchema,
  companyName: CompanyNameSchema.optional(),
  panId: RecordIdSchema,
  category: BidCategorySchema.optional(),
  lots: z.coerce.number().int().min(1).max(10_000),
  shares: z.coerce.number().int().min(1).max(10_000_000).optional(),
  bidPrice: z.coerce.number().positive().max(1_000_000),
  blockedAmount: z.coerce.number().positive().max(10_000_000_000).optional(),
});

export const ApplicationPatchSchema = z.object({
  id: RecordIdSchema,
  status: ApplicationStatusSchema,
  allottedShares: z.coerce.number().int().min(0).max(10_000_000).optional(),
});

export const PanProfileCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  relationship: RelationshipSchema,
  pan: PanInputSchema,
  broker: z.string().trim().max(40).optional(),
  dematId: z.string().trim().max(32).regex(/^[A-Za-z0-9]*$/, 'Demat ID must be alphanumeric').optional(),
  bankUpi: z.string().trim().max(100).regex(/^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32}$/, 'Invalid UPI ID').optional().or(z.literal('')),
});

export const WatchlistBodySchema = z.object({
  symbol: SymbolSchema,
  companyName: CompanyNameSchema.optional(),
});

export const NotificationBodySchema = z.object({
  action: z.enum(['markRead', 'markAllRead', 'delete', 'create']).optional(),
  id: RecordIdSchema.optional(),
  type: z.string().trim().max(40).optional(),
  title: z.string().trim().max(120).optional(),
  message: z.string().trim().max(500).optional(),
  symbol: SymbolSchema.optional(),
  metadata: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
});

export const OptimizeAllocationSchema = z.object({
  symbol: SymbolSchema.optional(),
  companyName: CompanyNameSchema.optional(),
  price: z.coerce.number().positive().max(1_000_000).optional(),
  lotSize: z.coerce.number().int().positive().max(1_000_000).optional(),
  gmp: z.coerce.number().min(-1_000_000).max(1_000_000).optional(),
  totalBudget: z.coerce.number().positive().max(10_000_000_000).optional(),
  strategy: z.enum(['max_probability', 'max_expected_profit', 'capital_efficient']).optional(),
  selectedPanIds: z.array(RecordIdSchema).max(50).optional(),
  /** Client copies of profiles: only their ids are used, to narrow the selection. */
  pans: z.array(z.object({ id: RecordIdSchema })).max(50).optional(),
});
