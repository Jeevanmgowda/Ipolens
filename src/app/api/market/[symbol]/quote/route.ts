import { NextResponse } from 'next/server';
import { MarketService, MarketDataUnavailableError } from '@/services/marketService';
import { handleRouteError, jsonError } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, props: { params: Promise<{ symbol: string }> }) {
  try {
    const { symbol } = await props.params;
    return NextResponse.json({ success: true, data: await MarketService.getQuote(symbol) });
  } catch (err) {
    if (err instanceof MarketDataUnavailableError) return jsonError(404, err.message);
    return handleRouteError(err, 'market/quote');
  }
}
