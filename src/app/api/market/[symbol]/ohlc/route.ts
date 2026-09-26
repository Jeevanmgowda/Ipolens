import { NextResponse } from 'next/server';
import { MarketService } from '@/services/marketService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  props: { params: Promise<{ symbol: string }> }
) {
  try {
    const params = await props.params;
    const symbol = params.symbol;
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '1D';

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol parameter is required' }, { status: 400 });
    }

    const candles = await MarketService.getOhlc(symbol, timeframe);

    return NextResponse.json({
      success: true,
      symbol: symbol.toUpperCase(),
      timeframe,
      count: candles.length,
      data: candles,
    });
  } catch (error: any) {
    console.error('API Error in /api/market/[symbol]/ohlc:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch OHLC candles', message: error.message },
      { status: 500 }
    );
  }
}
