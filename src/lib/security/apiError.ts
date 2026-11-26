import { NextResponse } from 'next/server';

/**
 * Safe API error handling: full details go to the server log; clients get a
 * generic message in production (raw error text can leak stack details, SQL,
 * upstream responses or file paths). In development the real message is kept
 * to make debugging easy.
 */

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function rawMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return '';
}

/** Message that is safe to send to the client. */
export function publicErrorMessage(err: unknown, fallback = 'Internal server error'): string {
  const message = rawMessage(err);
  return !isProduction() && message ? message : fallback;
}

/** Extra `message` field for responses, populated only outside production. */
export function errorDetail(err: unknown): { message?: string } {
  const message = rawMessage(err);
  return !isProduction() && message ? { message } : {};
}

/** Logs the error server-side and returns a JSON error response. */
export function apiErrorResponse(
  err: unknown,
  context: string,
  fallback = 'Internal server error',
  status = 500
): NextResponse {
  console.error(`[API] ${context}:`, err);
  return NextResponse.json({ success: false, error: publicErrorMessage(err, fallback) }, { status });
}
