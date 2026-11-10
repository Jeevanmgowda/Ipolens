import { NextRequest, NextResponse } from 'next/server';
import { drhpRagService } from '@/lib/services/drhp-rag.service';

export const dynamic = 'force-dynamic';

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
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { symbol, question, customText } = body;

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol is required' }, { status: 400 });
    }
    if (!question) {
      return NextResponse.json({ success: false, error: 'Question is required' }, { status: 400 });
    }

    const ragResult = await drhpRagService.queryRag(symbol, question, customText);

    return NextResponse.json({
      success: true,
      data: ragResult,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

