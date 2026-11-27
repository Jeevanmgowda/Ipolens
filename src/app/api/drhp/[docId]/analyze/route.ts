import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/security/session';
import { checkDistributedRateLimit } from '@/lib/security/rateLimiter';
import { handleRouteError, jsonError } from '@/lib/http';
import { getDocument } from '@/lib/services/drhp/document.service';
import { runAndStoreAnalysis, latestAnalysis } from '@/lib/services/drhp/analyst.service';
import { inngest, EVENTS, inngestAvailable } from '@/inngest/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Re-runs the 4-factor analysis for an indexed document. */
export async function POST(request: Request, props: { params: Promise<{ docId: string }> }) {
  try {
    const user = await requireUser(request);
    const { docId } = await props.params;
    const doc = await getDocument(docId);
    if (!doc) return jsonError(404, 'Document not found.');
    if (doc.status !== 'READY') return jsonError(409, `Document is ${doc.status.toLowerCase()}; wait for indexing to finish.`);
    const running = await latestAnalysis(docId);
    if (running?.status === 'RUNNING' && Date.now() - running.updatedAt.getTime() < 10 * 60000) {
      return NextResponse.json({ success: true, data: running, message: 'Analysis already running.' });
    }
    const limit = await checkDistributedRateLimit(`drhp-analyze:${user.id}`, 6, 3600);
    if (!limit.allowed) return jsonError(429, 'Analysis limit reached; try again later.');

    if (inngestAvailable()) {
      await inngest.send({ name: EVENTS.analyzeDrhp, data: { documentId: docId } });
      return NextResponse.json({ success: true, queued: true });
    }
    await runAndStoreAnalysis(docId);
    return NextResponse.json({ success: true, data: await latestAnalysis(docId) });
  } catch (err) {
    return handleRouteError(err, 'drhp/analyze');
  }
}
