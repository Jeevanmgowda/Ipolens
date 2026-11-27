import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/security/session';
import { handleRouteError, jsonError } from '@/lib/http';
import { getDocument } from '@/lib/services/drhp/document.service';
import { latestAnalysis } from '@/lib/services/drhp/analyst.service';

export const dynamic = 'force-dynamic';

/** Document indexing status plus the latest analysis (poll this while status is QUEUED/INDEXING/RUNNING). */
export async function GET(request: Request, props: { params: Promise<{ docId: string }> }) {
  try {
    await requireUser(request);
    const { docId } = await props.params;
    const doc = await getDocument(docId);
    if (!doc) return jsonError(404, 'Document not found.');
    const analysis = await latestAnalysis(docId);
    return NextResponse.json({ success: true, data: { document: doc, analysis } });
  } catch (err) {
    return handleRouteError(err, 'drhp/[docId]:GET');
  }
}
