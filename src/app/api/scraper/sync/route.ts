import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/security/session';
import { runIpoIngestion } from '@/lib/ingestion/ipo-ingestion.service';
import { predictActiveIpos } from '@/lib/services/gmp-prediction.service';
import { IpoRepository } from '@/lib/repositories/ipo.repository';
import { inngest, EVENTS, inngestAvailable } from '@/inngest/client';
import { handleRouteError, jsonError } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Ingestion health: how many IPOs are tracked and when the data was last refreshed. */
export async function GET() {
  try {
    const [counts, all] = await Promise.all([IpoRepository.countBy(), IpoRepository.listAll()]);
    const lastFetched = all.map((r) => r.fetchedAt || '').sort().pop() || null;
    return NextResponse.json({
      success: true,
      totalCount: all.length,
      summary: counts,
      lastFetchedAt: lastFetched,
      ageMinutes: lastFetched ? Math.round((Date.now() - new Date(lastFetched).getTime()) / 60000) : null,
    });
  } catch (err) {
    return handleRouteError(err, 'scraper/sync:GET');
  }
}

/**
 * Triggers a live ingestion run. Allowed for CRON_SECRET bearer tokens or signed-in admins.
 * Uses Inngest when available, otherwise runs inline.
 */
export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const bearerOk = Boolean(cronSecret) && request.headers.get('authorization') === `Bearer ${cronSecret}`;
    if (!bearerOk) {
      const user = await getAuthenticatedUser(request);
      if (!user) return jsonError(401, 'Sign in required.');
      if (user.role !== 'admin') return jsonError(403, 'Administrator role required.');
    }

    if (inngestAvailable()) {
      await inngest.send({ name: EVENTS.ingestIpos, data: {} });
      return NextResponse.json({ success: true, queued: true, message: 'Ingestion queued in Inngest.' });
    }

    const report = await runIpoIngestion();
    const predictions = await predictActiveIpos();
    return NextResponse.json({ success: report.errors.length === 0 || report.upserted > 0, report, predictions });
  } catch (err) {
    return handleRouteError(err, 'scraper/sync:POST');
  }
}
