import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/security/session';
import { checkDistributedRateLimit } from '@/lib/security/rateLimiter';
import { handleRouteError, jsonError } from '@/lib/http';
import { askDocument } from '@/lib/services/drhp/analyst.service';

export const dynamic = 'force-dynamic';

const Body = z.object({ question: z.string().trim().min(3).max(500) });

/** Grounded Q&A over one indexed DRHP, with page citations. */
export async function POST(request: Request, props: { params: Promise<{ docId: string }> }) {
  try {
    const user = await requireUser(request);
    const { docId } = await props.params;
    const { question } = Body.parse(await request.json());
    const limit = await checkDistributedRateLimit(`drhp-ask:${user.id}`, 30, 3600);
    if (!limit.allowed) return jsonError(429, 'Question limit reached; try again later.');
    return NextResponse.json({ success: true, data: await askDocument(docId, question) });
  } catch (err) {
    return handleRouteError(err, 'drhp/ask');
  }
}
