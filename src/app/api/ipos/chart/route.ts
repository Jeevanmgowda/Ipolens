import { NextResponse } from 'next/server';
import { fetchIpoLiveChart } from '@/services/listedIpoService';
import { getIpoChart } from '@/lib/market/ipoMarketData';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const range = searchParams.get('range') || '1mo';

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'Symbol query parameter is required' },
        { status: 400 }
      );
    }

    const mock = process.env.USE_MOCK_MARKET_DATA === 'true';
    const chartData = mock ? await fetchIpoLiveChart(symbol, range) : await getIpoChart(symbol, range);

    if (!chartData) {
      return NextResponse.json(
        { success: false, error: `Live chart for symbol "${symbol}" is unavailable.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: chartData,
      source: chartData && 'source' in chartData ? `${chartData.source} (${chartData.ticker}, delayed up to 15 min)` : 'Demo data',
    });
  } catch (error: any) {
    console.error('API Error in /api/ipos/chart:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch IPO live chart data', message: error.message },
      { status: 500 }
    );
  }
}
