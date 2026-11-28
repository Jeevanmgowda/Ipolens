import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import fs from 'fs';
import path from 'path';
import { getAuthenticatedUser } from '@/lib/security/session';
import { isAdmin } from '@/lib/security/guards';
import { DatabaseUnavailableError, isDatabaseConfigured } from '@/db';
import { IpoRepository } from '@/lib/repositories/ipo.repository';
import { runIpoIngestion } from '@/lib/ingestion/ipo-ingestion.service';
import { runBackfill } from '@/lib/ingestion/backfill';
import { importSnapshot, type SnapshotFile } from '@/lib/ingestion/json-import';
import { recordSyncRun, readSyncHealth } from '@/lib/ingestion/sync-health';
import { refreshListedQuotes } from '@/lib/ingestion/quotes';
import { clearSupabaseIpoCache } from '@/services/supabaseIpoProvider';

/**
 * IPO data sync into Supabase.
 *
 * GET  — public status: counts per lifecycle stage straight from the database and the last run.
 * POST — CRON_SECRET bearer or a signed-in admin. Body `{ mode }`:
 *   "live"        (default) InvestorGain live report + details, cross-checked with BSE
 *   "backfill"    one bounded batch of the 12-month backfill; pass `fromId` = previous `nextId`
 *   "import-json" one-time import of the data/ipos.json snapshot
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const SNAPSHOT_FILE = path.resolve(process.cwd(), 'data', 'ipos.json');

function bearerMatches(header: string, secret: string | undefined): boolean {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const intIn = (v: unknown, min: number, max: number): number | undefined => {
  const n = Number(v);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : undefined;
};

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ exists: false, error: 'Database is not configured (DATABASE_URL).' }, { status: 503 });
  }
  try {
    const counts = await IpoRepository.countBy();
    const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
    const health = await readSyncHealth();
    return NextResponse.json({
      exists: totalCount > 0,
      store: 'supabase',
      totalCount,
      summary: { open: counts.Open, upcoming: counts.Upcoming, closed: counts.Closed, listed: counts.Listed },
      lastRun: health.lastRun,
      lastSuccessAt: health.lastSuccessAt,
      generatedAt: health.lastSuccessAt,
      ageMinutes: health.lastSuccessAt
        ? Math.round((Date.now() - new Date(health.lastSuccessAt).getTime()) / 60000)
        : null,
      sources: ['InvestorGain (GMP, subscription, issue details)', 'BSE India (official public issues)'],
    });
  } catch (error) {
    const unavailable = error instanceof DatabaseUnavailableError;
    return NextResponse.json(
      { exists: false, error: unavailable ? 'Database is not reachable.' : 'Failed to read sync status.' },
      { status: unavailable ? 503 : 500 }
    );
  }
}

export async function POST(req: Request) {
  const isCron = bearerMatches(req.headers.get('authorization') || '', process.env.CRON_SECRET);
  if (!isCron) {
    const user = await getAuthenticatedUser(req);
    if (!isAdmin(user)) {
      return NextResponse.json(
        { success: false, error: 'Access denied: an admin session or a valid CRON_SECRET is required.' },
        { status: 403 }
      );
    }
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ success: false, error: 'Database is not configured (DATABASE_URL).' }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = typeof body.mode === 'string' ? body.mode : 'live';
  const startedAt = new Date().toISOString();

  try {
    if (mode === 'live') {
      const ingestion = await runIpoIngestion();
      const quotes = await refreshListedQuotes().catch((err) => ({ error: (err as Error).message }));
      const report = { ...ingestion, quotes };
      const ok = ingestion.upserted > 0 || ingestion.errors.length === 0;
      await recordSyncRun({ mode, startedAt, ok, summary: report });
      clearSupabaseIpoCache();
      return NextResponse.json({ success: ok, mode, report }, { status: ok ? 200 : 502 });
    }

    if (mode === 'backfill') {
      const report = await runBackfill({
        fromId: intIn(body.fromId, 1, 10_000_000),
        maxRequests: intIn(body.maxRequests, 1, 120),
        months: intIn(body.months, 1, 24),
      });
      await recordSyncRun({ mode, startedAt, ok: true, summary: report });
      clearSupabaseIpoCache();
      return NextResponse.json({ success: true, mode, report });
    }

    if (mode === 'import-json') {
      if (!fs.existsSync(SNAPSHOT_FILE)) {
        return NextResponse.json({ success: false, error: 'data/ipos.json not found.' }, { status: 404 });
      }
      const file = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf-8')) as SnapshotFile;
      const report = await importSnapshot(file);
      await recordSyncRun({ mode, startedAt, ok: report.errors.length === 0, summary: report });
      clearSupabaseIpoCache();
      return NextResponse.json({ success: true, mode, report });
    }

    return NextResponse.json(
      { success: false, error: 'mode must be one of "live", "backfill", "import-json".' },
      { status: 400 }
    );
  } catch (error) {
    const unavailable = error instanceof DatabaseUnavailableError;
    console.error('[scraper/sync]', mode, (error as Error)?.message);
    await recordSyncRun({ mode, startedAt, ok: false, summary: { error: (error as Error)?.message } }).catch(() => {});
    return NextResponse.json(
      { success: false, error: unavailable ? 'Database is not reachable.' : 'Sync failed. See server logs.' },
      { status: unavailable ? 503 : 500 }
    );
  }
}
