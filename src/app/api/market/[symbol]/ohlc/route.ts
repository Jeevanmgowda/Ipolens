import { NextResponse } from 'next/server';
import { MarketService, MarketDataUnavailableError } from '@/services/marketService';
import { handleRouteError, jsonError } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ symbol: string }> }) {
  try {
    const { symbol } = await props.params;
    const timeframe = new URL(request.url).searchParams.get('timeframe') || '1D';
    const { candles, source, ticker } = await MarketService.getOhlc(symbol, timeframe);
    return NextResponse.json({ success: true, symbol: symbol.toUpperCase(), ticker, timeframe, source, count: candles.length, data: candles });
  } catch (err) {
    if (err instanceof MarketDataUnavailableError) return jsonError(404, err.message);
    return handleRouteError(err, 'market/ohlc');
  }
}
