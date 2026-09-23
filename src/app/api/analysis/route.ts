import { NextResponse } from 'next/server';
import { analyzeDrhpFiling } from '@/services/geminiAnalyst';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const companyName = searchParams.get('companyName') || undefined;
    const drhpText = searchParams.get('drhpText') || undefined;

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol is required' }, { status: 400 });
    }

    const analysis = await analyzeDrhpFiling(symbol, companyName, drhpText);

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { symbol, companyName, drhpText } = body;

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol is required' }, { status: 400 });
    }

    const analysis = await analyzeDrhpFiling(symbol, companyName, drhpText);

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
