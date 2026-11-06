import { NextResponse } from 'next/server';
import { RegistrarScannerService } from '@/lib/services/registrar-scanner.service';
import { isValidPan } from '@/services/duplicateEnforcer';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      symbol,
      companyName,
      pan,
      price,
      lotSize,
      applicationNo,
      dpClientId,
    } = body;

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'IPO Symbol is required.' },
        { status: 400 }
      );
    }

    if (!pan || typeof pan !== 'string') {
      return NextResponse.json(
        { success: false, error: 'PAN number is required for allotment inquiry.' },
        { status: 400 }
      );
    }

    const cleanPan = pan.trim().toUpperCase();
    if (!isValidPan(cleanPan)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid PAN format. Please enter a valid 10-character PAN (e.g. ABCDE1234F).',
        },
        { status: 400 }
      );
    }

    const result = await RegistrarScannerService.inquireSinglePan(symbol, cleanPan, {
      companyName,
      price: price ? Number(price) : undefined,
      lotSize: lotSize ? Number(lotSize) : undefined,
      applicationNo,
      dpClientId,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error: any) {
    console.error('Error in /api/allotment/check:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to execute registrar allotment inquiry.',
      },
      { status: 500 }
    );
  }
}

