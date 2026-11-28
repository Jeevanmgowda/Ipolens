import { NextRequest, NextResponse } from 'next/server';
import { MarketDataService, type ChartTimeframe } from '@/lib/services/market-data.service';
import { publicErrorMessage } from '@/lib/security/apiError';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await context.params;
    const { searchParams } = new URL(req.url);
    const cleanSymbol = symbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').trim();
    if (!cleanSymbol) {
      return NextResponse.json({ success: false, error: 'Symbol is required' }, { status: 400 });
    }

    const rawTf = (searchParams.get('timeframe') || '1M').toUpperCase();
    const validTfs: ChartTimeframe[] = ['1D', '1W', '1M', '1Y'];
    const timeframe: ChartTimeframe = validTfs.includes(rawTf as ChartTimeframe)
      ? (rawTf as ChartTimeframe)
      : '1M';

    const { candles, provider } = await MarketDataService.getCandles(cleanSymbol, timeframe);

    return NextResponse.json({
      success: true,
      symbol: cleanSymbol,
      timeframe,
      provider,
      count: candles.length,
      candles,
    });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
