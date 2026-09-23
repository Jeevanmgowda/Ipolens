import { NextRequest, NextResponse } from 'next/server';
import { MarketChartService } from '@/lib/services/market-chart.service';
import { SymbolTokenService } from '@/lib/services/symbol-token.service';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await context.params;
    const { searchParams } = new URL(req.url);
    const cleanSymbol = symbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '');

    // Resolve token from query param or from SymbolTokenService
    const tokenParam = searchParams.get('token');
    const token = tokenParam || SymbolTokenService.getTokenBySymbol(cleanSymbol);

    const from = searchParams.get('from') || '2026-09-01 09:15';
    const to = searchParams.get('to') || '2026-09-20 15:30';
    const intervalParam = (searchParams.get('interval') as 'ONE_MINUTE' | 'FIVE_MINUTE' | 'ONE_DAY') || 'FIVE_MINUTE';

    if (!token) {
      return NextResponse.json(
        { error: `Token is required or symbol '${cleanSymbol}' could not be resolved to an exchange token` },
        { status: 400 }
      );
    }

    const candles = await MarketChartService.getHistoricalCandles(
      token,
      intervalParam,
      from,
      to,
      process.env.ANGEL_ONE_JWT_TOKEN,
      process.env.ANGEL_ONE_API_KEY
    );

    return NextResponse.json({
      success: true,
      symbol: cleanSymbol,
      token,
      interval: intervalParam,
      count: candles.length,
      candles,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
