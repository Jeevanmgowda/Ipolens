import { NextResponse } from 'next/server';
import { AllotmentService } from '@/lib/services/allotment/allotment.service';
import { TrustedIpoRegistry } from '@/lib/services/allotment/trustedIpoRegistry';

export const dynamic = 'force-dynamic';

/**
 * Helper to securely extract client IP for rate limiting
 */
function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

/**
 * GET /api/allotment/check
 * Returns list of trusted IPO offerings and verified registrar configurations
 */
export async function GET() {
  const ipos = TrustedIpoRegistry.getTrustedIposList();
  return NextResponse.json({
    success: true,
    data: {
      ipos,
      privacyPolicy: {
        zeroRetention: true,
        panStorage: 'none',
        description: 'PAN numbers are never persisted, cached, or logged. Transmitted strictly in memory to official registrar gateways.',
      },
    },
  });
}

/**
 * POST /api/allotment/check
 * Securely verifies IPO allotment for a given PAN number without storing or exposing raw credentials.
 */
export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    let body: any;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Malformed JSON payload.' },
        { status: 400 }
      );
    }

    const {
      symbol,
      pan,
      applicationNo,
      dpClientId,
      price,
      lotSize,
    } = body || {};

    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json(
        { success: false, error: 'IPO Symbol is required.' },
        { status: 400 }
      );
    }

    if (!pan || typeof pan !== 'string') {
      return NextResponse.json(
        { success: false, error: 'PAN number is required for official allotment inquiry.' },
        { status: 400 }
      );
    }

    // Call secure allotment service
    const result = await AllotmentService.checkAllotment({
      symbol,
      pan,
      clientIp,
      applicationNo,
      dpClientId,
      price: price ? Number(price) : undefined,
      lotSize: lotSize ? Number(lotSize) : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: result.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.data,
        message: result.data?.explanation,
      },
      { status: 200 }
    );
  } catch (err: any) {
    // Note: Do NOT log request parameters or PAN to protect user privacy
    console.error('[Allotment Check API] Internal execution error:', err?.message || 'Unknown error');
    return NextResponse.json(
      {
        success: false,
        error: 'An internal error occurred while processing the allotment inquiry. Please try again.',
      },
      { status: 500 }
    );
  }
}
