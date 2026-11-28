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
