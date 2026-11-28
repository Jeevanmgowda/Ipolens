import { NextRequest, NextResponse } from 'next/server';
import { drhpRagService } from '@/lib/services/drhp-rag.service';
import { requireAiAccess } from '@/lib/security/aiGuard';
import { DrhpTextSchema, QuestionSchema, SymbolSchema, firstIssue } from '@/lib/security/schemas';
import { z } from 'zod';
import { apiErrorResponse } from '@/lib/security/apiError';

export const dynamic = 'force-dynamic';

const DrhpRagBodySchema = z.object({
  symbol: SymbolSchema,
  question: QuestionSchema,
  customText: DrhpTextSchema.optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = (searchParams.get('symbol') || '').trim().toUpperCase();
    const action = searchParams.get('action') || 'sections';
    const query = searchParams.get('q') || '';

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol is required' }, { status: 400 });
    }

    if (action === 'retrieve' && query) {
      const topK = parseInt(searchParams.get('topK') || '4', 10);
      const chunks = drhpRagService.retrieveChunks(symbol, query, topK);
      return NextResponse.json({
        success: true,
        symbol,
        query,
        chunks,
      });
    }

    if (action === 'matrix') {
      const matrix = drhpRagService.getForensicRiskMatrix(symbol);
      return NextResponse.json({
        success: true,
        symbol,
        forensicRiskMatrix: matrix,
      });
    }

    // Default action: sections / chapter TOC
    const sections = drhpRagService.getDrhpSections(symbol);
    return NextResponse.json({
      success: true,
      symbol,
      sections,
    });
  } catch (err: any) {
    return apiErrorResponse(err, '/api/market/drhp-rag');
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireAiAccess(req);
    if ('response' in access) return access.response;

    const parsed = DrhpRagBodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 });
    }
    const { symbol, question, customText } = parsed.data;

    // customText is indexed into the caller's private slot, never the shared index (H1).
    const ragResult = await drhpRagService.queryRag(symbol, question, customText, access.user.id);

    return NextResponse.json({
      success: true,
      data: ragResult,
    });
  } catch (err: any) {
    return apiErrorResponse(err, '/api/market/drhp-rag');
  }
}
