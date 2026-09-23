import { NextResponse } from 'next/server';
import { fetchIpoLiveChart } from '@/services/listedIpoService';

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

    const chartData = await fetchIpoLiveChart(symbol, range);

    if (!chartData) {
      return NextResponse.json(
        { success: false, error: `Live chart for symbol "${symbol}" is unavailable.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: chartData,
      source: 'NSE Live Intraday & Daily Ticker Gateway',
    });
  } catch (error: any) {
    console.error('API Error in /api/ipos/chart:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch IPO live chart data', message: error.message },
      { status: 500 }
    );
  }
}
