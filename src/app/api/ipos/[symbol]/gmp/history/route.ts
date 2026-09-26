import { NextResponse } from 'next/server';
import { IpoService } from '@/services/ipoService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  props: { params: Promise<{ symbol: string }> }
) {
  try {
    const params = await props.params;
    const symbol = params.symbol;
    const { searchParams } = new URL(request.url);
    const rawTf = searchParams.get('timeframe') || '7D';
    const timeframe = (['1D', '7D', '1M', 'All'].includes(rawTf) ? rawTf : '7D') as '1D' | '7D' | '1M' | 'All';

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol parameter is required' }, { status: 400 });
    }

    const history = await IpoService.getGmpHistory(symbol, timeframe);

    if (!history) {
      return NextResponse.json(
        { success: false, error: `GMP history for "${symbol}" is not available.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    console.error('API Error in /api/ipos/[symbol]/gmp/history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch GMP history', message: error.message },
      { status: 500 }
    );
  }
}
