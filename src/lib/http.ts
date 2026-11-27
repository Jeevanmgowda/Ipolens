import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { DatabaseUnavailableError } from '@/db';
import { ConfigurationError } from '@/lib/env';
import { UnauthorizedError } from '@/lib/security/session';

/** Domain "not found or not owned" error, mapped to 404 so ownership is never leaked. */
export class NotFoundError extends Error {
  constructor(message = 'Not found.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

export function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...extra }, { status });
}

/** Maps known error types to HTTP responses; everything else is a 500 without internals. */
export function handleRouteError(err: unknown, context: string) {
  if (err instanceof UnauthorizedError) return jsonError(401, err.message);
  if (err instanceof NotFoundError) return jsonError(404, err.message);
  if (err instanceof BadRequestError) return jsonError(400, err.message);
  if (err instanceof ZodError) {
    return jsonError(400, 'Invalid request body.', { issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  }
  if (err instanceof DatabaseUnavailableError || err instanceof ConfigurationError) {
    return jsonError(503, err.message);
  }
  console.error(`[${context}]`, err instanceof Error ? err.message : err);
  return jsonError(500, 'Internal server error.');
}
