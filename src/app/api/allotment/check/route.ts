import { NextResponse } from 'next/server';
import { AllotmentService } from '@/lib/services/allotment/allotment.service';
import { TrustedIpoRegistry } from '@/lib/services/allotment/trustedIpoRegistry';
import { getClientIp } from '@/lib/security/rateLimiter';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/security/session';
import { hashPanForLookup, isRawPan } from '@/lib/security/panEncryption';
import { getPrimaryPanHash } from '@/services/authStore';
import { DbRepositoryService } from '@/lib/services/db-repository.service';

export const dynamic = 'force-dynamic';

const MAX_PAYLOAD_BYTES = 8192; // 8 KB payload guard

// Client IP comes from the shared trusted-proxy-aware helper (audit H7).

/**
 * GET /api/allotment/check
 * Returns list of trusted IPO offerings from authoritative server directory
 * and privacy policy guarantees.
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
        description:
          'PAN numbers are sensitive personal financial data. They are processed strictly in-memory for the single requested lookup, never persisted, never logged, and never sent to client analytics or third parties.',
        sebiCompliance: 'Fully compliant with SEBI and Indian Digital Personal Data Protection (DPDP) Act rules.',
      },
    },
  });
}

/**
 * POST /api/allotment/check
 * Securely verifies IPO allotment status for a given PAN number without storing or exposing raw credentials.
 */
export async function POST(request: Request) {
  try {
    // 0. Signed-in users only, and only for PANs on their own account
    //    (docs/security/AUDIT_2026-11-27.md, M1): no looking up other people's allotments.
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    // 1. Guard against payload abuse
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Request payload too large (max 8KB).' },
        { status: 413 }
      );
    }

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
      ipoId,
      pan,
      applicationNo,
      dpClientId,
      price,
      lotSize,
    } = body || {};

    const targetSymbol = symbol || ipoId;
    if (!targetSymbol || typeof targetSymbol !== 'string') {
      return NextResponse.json(
        { success: false, error: 'IPO Symbol or ID is required.' },
        { status: 400 }
      );
    }

    if (!pan || typeof pan !== 'string') {
      return NextResponse.json(
        { success: false, error: 'PAN number is required for official allotment inquiry.' },
        { status: 400 }
      );
    }

    const normalizedPan = pan.trim().toUpperCase();
    if (!isRawPan(normalizedPan)) {
      return NextResponse.json(
        { success: false, error: 'Invalid PAN format. PAN must be 10 characters (e.g. ABCDE1234F).' },
        { status: 400 }
      );
    }
    const ownsPan =
      getPrimaryPanHash(user.id) === hashPanForLookup(normalizedPan) ||
      (await DbRepositoryService.userOwnsFamilyPan(user.id, normalizedPan));
    if (!ownsPan) {
      return NextResponse.json(
        {
          success: false,
          error: 'You can only check allotment for your own PAN or a family PAN saved in the Family PAN Manager.',
        },
        { status: 403 }
      );
    }

    // Call secure allotment service (PAN is validated and scoped strictly in-memory)
    const result = await AllotmentService.checkAllotment({
      symbol: targetSymbol,
      pan: normalizedPan,
      clientIp,
      userId: user.id,
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

    // Return strictly normalized result containing masked PAN only
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
