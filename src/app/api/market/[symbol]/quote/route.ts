import { NextResponse } from 'next/server';
import { MarketService } from '@/services/marketService';
import { errorDetail } from '@/lib/security/apiError';

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

    const quote = await MarketService.getQuote(symbol);

    return NextResponse.json({
      success: true,
      data: quote,
    });
  } catch (error: any) {
    console.error('API Error in /api/market/[symbol]/quote:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch live market quote', ...errorDetail(error) },
      { status: 500 }
    );
  }
}
