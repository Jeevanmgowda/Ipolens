import { NextResponse } from 'next/server';
import { isDatabaseActive, isPostgresConfigured } from '@/db';

export const dynamic = 'force-dynamic';

/**
 * Liveness/readiness probe for uptime monitors and load balancers
 * (docs/security/AUDIT_2026-11-27.md, R18; checklist #71/#77).
 * Reports only booleans: no versions, hostnames or configuration values.
 * Returns 503 when PostgreSQL is configured but currently unreachable.
 */
export async function GET() {
  const databaseReady = !isPostgresConfigured || isDatabaseActive();
  const body = {
    status: databaseReady ? 'ok' : 'degraded',
    database: isPostgresConfigured ? (isDatabaseActive() ? 'up' : 'down') : 'not-configured',
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(body, {
    status: databaseReady ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
