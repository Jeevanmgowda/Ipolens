import { NextResponse } from 'next/server';
import { scanRegistrarText, OFFICIAL_REGISTRARS } from '@/services/allotmentScanner';

export async function GET() {
  return NextResponse.json({
    success: true,
    registrars: OFFICIAL_REGISTRARS,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, ipoSymbol } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Text content is required for allotment scanning.' },
        { status: 400 }
      );
    }

    const scanResult = scanRegistrarText(text);

    return NextResponse.json({
      success: true,
      data: scanResult,
      message: scanResult.parsedSuccessfully
        ? `Status classified as: ${scanResult.status} (Confidence: ${Math.round(scanResult.rawConfidence * 100)}%)`
        : 'Could not confidently determine allotment status. Please ensure full registrar output is pasted.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
