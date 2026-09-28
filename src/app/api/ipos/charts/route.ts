import { NextRequest, NextResponse } from 'next/server';
import { UpstoxChartService } from '@/lib/services/upstox-chart.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const instrumentKey = searchParams.get('instrumentKey') || searchParams.get('symbol') || 'SWIGGY';
    const intervalParam = searchParams.get('interval') || 'day';
    const fromDate = searchParams.get('from') || searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('to') || searchParams.get('toDate') || undefined;

    const interval: '1minute' | '30minute' | 'day' =
      intervalParam === '1minute' || intervalParam === '1m'
        ? '1minute'
        : intervalParam === '30minute' || intervalParam === '30m'
        ? '30minute'
        : 'day';

    const candles = await UpstoxChartService.getHistoricalCandles(
      instrumentKey,
      interval,
      fromDate,
      toDate
    );

    return NextResponse.json({
      success: true,
      instrumentKey: UpstoxChartService.resolveInstrumentKey(instrumentKey),
      interval,
      count: candles.length,
      candles,
    });
  } catch (error: any) {
    console.error('API Error in GET /api/ipos/charts:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch historical candlestick feed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
