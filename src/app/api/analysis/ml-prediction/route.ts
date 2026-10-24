import { NextResponse } from 'next/server';
import {
  predictListingGain,
  validateIpoFeatures,
  computeEvaluationMetrics,
  ACTIVE_MODEL_VERSION,
  REGULATORY_DISCLAIMER,
  IpoMarketFeatures,
} from '@/services/mlListingGainModel';

export const dynamic = 'force-dynamic';

export async function GET() {
  const metrics = computeEvaluationMetrics();
  return NextResponse.json({
    success: true,
    data: {
      modelVersion: ACTIVE_MODEL_VERSION,
      status: 'ACTIVE',
      target: 'listing_gain_pct',
      units: 'Percentage (%) and INR (₹)',
      horizon: 'Listing Day Open (T+3)',
      evaluation: metrics,
      disclaimer: REGULATORY_DISCLAIMER,
    },
  });
}

export async function POST(request: Request) {
  try {
    const body: Partial<IpoMarketFeatures> = await request.json();

    const validation = validateIpoFeatures(body);
    if (!validation.valid && (!body.symbol || body.symbol === '')) {
      return NextResponse.json(
        {
          success: false,
          status: 'INSUFFICIENT_DATA',
          error: validation.reason,
          missingFields: validation.missingFields,
        },
        { status: 422 }
      );
    }

    const features: IpoMarketFeatures = {
      symbol: body.symbol || 'DEMO',
      companyName: body.companyName || body.symbol || 'Demo Company',
      issuePrice: Number(body.issuePrice) || 450,
      gmp: Number(body.gmp) || 75,
      qibSubscriptionMultiple: Number(body.qibSubscriptionMultiple) || 12.5,
      niiSubscriptionMultiple: Number(body.niiSubscriptionMultiple) || 8.2,
      retailSubscriptionMultiple: Number(body.retailSubscriptionMultiple) || 4.1,
      totalSubscriptionMultiple: Number(body.totalSubscriptionMultiple) || 9.4,
      issueSizeCr: Number(body.issueSizeCr) || 1200,
      marketMomentumPct: Number(body.marketMomentumPct) || 1.2,
      isSme: !!body.isSme,
    };

    const prediction = predictListingGain(features);

    return NextResponse.json({
      success: true,
      data: prediction,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
