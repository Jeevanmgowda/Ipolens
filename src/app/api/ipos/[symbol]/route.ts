import { NextResponse } from 'next/server';
import { fetchLiveIpoDetail } from '@/services/nseIpoService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  props: { params: Promise<{ symbol: string }> }
) {
  try {
    const params = await props.params;
    const symbol = params.symbol;

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol parameter is required' }, { status: 400 });
    }

    const detail = await fetchLiveIpoDetail(symbol);

    if (!detail) {
      return NextResponse.json(
        { success: false, error: `IPO details for symbol "${symbol}" not found on NSE India` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: detail,
      source: 'National Stock Exchange of India (NSE)',
    });
  } catch (error: any) {
    console.error('API Error in /api/ipos/[symbol]:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch live IPO detail', message: error.message },
      { status: 500 }
    );
  }
}
