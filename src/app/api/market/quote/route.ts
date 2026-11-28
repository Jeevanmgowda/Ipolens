import { NextRequest, NextResponse } from 'next/server';
import { MarketDataService } from '@/lib/services/market-data.service';
import { errorDetail } from '@/lib/security/apiError';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawSymbols = searchParams.get('symbols') || '';
    const symbols = rawSymbols
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (symbols.length === 0) {
      return NextResponse.json(
        { success: false, error: 'symbols query parameter is required (e.g. ?symbols=TATATECH,SWIGGY)' },
        { status: 400 }
      );
    }

    const { quotes, provider } = await MarketDataService.getQuotes(symbols);

    return NextResponse.json({
      success: true,
      provider,
      count: Object.keys(quotes).length,
      quotes,
    });
  } catch (error: unknown) {
    console.error('API Error in GET /api/market/quote:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch live market quotes', ...errorDetail(error) },
      { status: 500 }
    );
  }
}
