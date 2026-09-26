import { NextResponse } from 'next/server';
import { IpoService } from '@/services/ipoService';

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

    const gmpData = await IpoService.getGmp(symbol);

    if (!gmpData) {
      return NextResponse.json(
        { success: false, error: `GMP data for "${symbol}" is not available.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: gmpData,
    });
  } catch (error: any) {
    console.error('API Error in /api/ipos/[symbol]/gmp:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch GMP quote', message: error.message },
      { status: 500 }
    );
  }
}
