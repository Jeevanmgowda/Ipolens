import { NextResponse } from 'next/server';
import {
  predictListingGain,
  validateIpoFeatures,
  computeEvaluationMetrics,
  ACTIVE_MODEL_VERSION,
  REGULATORY_DISCLAIMER,
  IpoMarketFeatures,
  MlListingGainPrediction,
} from '@/services/mlListingGainModel';
import { IpoService } from '@/services/ipoService';
import { LiveMarketIpoItem } from '@/types/liveMarket';
import { isIpoListed } from '@/services/ipoDataProvider';
import { publicErrorMessage } from '@/lib/security/apiError';

export const dynamic = 'force-dynamic';

function getEffectiveStatus(ipo: LiveMarketIpoItem): 'upcoming' | 'open' | 'closed' | 'listed' {
  if (isIpoListed(ipo) || ipo.status === 'Listed') return 'listed';
  const rem = (ipo.remainingTime || '').toLowerCase();
  if (rem.includes('bidding closed') || rem.includes('closed') || ipo.status === 'Closed') {
    return 'closed';
  }
  if (ipo.status === 'Open') return 'open';
  if (ipo.status === 'Upcoming') return 'upcoming';
  return 'closed';
}

function mapIpoToFeatures(ipo: LiveMarketIpoItem): IpoMarketFeatures {
  const priceBand = ipo.priceBand || '';
  const priceNums = priceBand.replace(/,/g, '').match(/\d+(?:\.\d+)?/g);
  const cutoffPrice =
    ipo.priceHigh && ipo.priceHigh > 0
      ? ipo.priceHigh
      : ipo.priceLow && ipo.priceLow > 0
      ? ipo.priceLow
      : ipo.listingPrice && ipo.listingPrice > 0
      ? ipo.listingPrice
      : priceNums && priceNums.length > 0
      ? parseFloat(priceNums[priceNums.length - 1])
      : 100;

  const issueSizeInCr =
    ipo.issueSizeCr && ipo.issueSizeCr > 0
      ? ipo.issueSizeCr
      : ipo.issueSize
      ? parseFloat(ipo.issueSize.replace(/[^0-9.]/g, '')) || 100
      : 100;

  const effStatus = getEffectiveStatus(ipo);

  return {
    symbol: ipo.symbol.toUpperCase(),
    companyName: ipo.companyName || ipo.symbol,
    issuePrice: cutoffPrice,
    gmp: ipo.gmp || 0,
    gmpPercent: ipo.gmpPercent || 0,
    qibSubscriptionMultiple: ipo.qibSubscription || 0,
    niiSubscriptionMultiple: ipo.niiSubscription || 0,
    retailSubscriptionMultiple: ipo.retailSubscription || 0,
    totalSubscriptionMultiple: ipo.currentSubscription || 0,
    issueSizeCr: issueSizeInCr,
    isSme: ipo.series === 'SME',
    status: effStatus,
    listingPrice: ipo.listingPrice || (effStatus === 'listed' ? ipo.currentPrice : undefined),
    marketMomentumPct: 1.2,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolParam = searchParams.get('symbol');
    const allParam = searchParams.get('all');

    // 1. Single Symbol Query
    if (symbolParam && symbolParam.trim() !== '') {
      const cleanSymbol = symbolParam.trim().toUpperCase();
      const ipo = await IpoService.getIpoDetails(cleanSymbol);

      if (!ipo) {
        return NextResponse.json(
          {
            success: false,
            error: `IPO symbol "${cleanSymbol}" not found in real-time primary market feeds.`,
          },
          { status: 404 }
        );
      }

      const features = mapIpoToFeatures(ipo);
      const prediction = predictListingGain(features);

      return NextResponse.json({
        success: true,
        data: prediction,
      });
    }

    // 2. All IPOs Bulk Inference
    if (allParam === 'true') {
      const allIpos = await IpoService.getAllIpos();
      const predictions: MlListingGainPrediction[] = allIpos.map((ipo) => {
        const feat = mapIpoToFeatures(ipo);
        return predictListingGain(feat);
      });

      return NextResponse.json({
        success: true,
        count: predictions.length,
        data: predictions,
      });
    }

    // 3. Default: Model Metrics & Evaluation Benchmarks
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
  } catch (err: any) {
    return NextResponse.json({ success: false, error: publicErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: Partial<IpoMarketFeatures> = await request.json();

    if (!body.symbol || body.symbol.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          status: 'INSUFFICIENT_DATA',
          error: 'Symbol parameter is required for ML listing gain estimation.',
          missingFields: ['symbol'],
        },
        { status: 422 }
      );
    }

    const cleanSymbol = body.symbol.trim().toUpperCase();
    const liveIpo = await IpoService.getIpoDetails(cleanSymbol);

    let baseFeatures: IpoMarketFeatures;

    if (liveIpo) {
      baseFeatures = mapIpoToFeatures(liveIpo);
      // Allow custom caller overrides while preserving real company background
      if (body.issuePrice !== undefined && body.issuePrice > 0) baseFeatures.issuePrice = Number(body.issuePrice);
      if (body.gmp !== undefined) baseFeatures.gmp = Number(body.gmp);
      if (body.qibSubscriptionMultiple !== undefined) baseFeatures.qibSubscriptionMultiple = Number(body.qibSubscriptionMultiple);
      if (body.niiSubscriptionMultiple !== undefined) baseFeatures.niiSubscriptionMultiple = Number(body.niiSubscriptionMultiple);
      if (body.retailSubscriptionMultiple !== undefined) baseFeatures.retailSubscriptionMultiple = Number(body.retailSubscriptionMultiple);
      if (body.totalSubscriptionMultiple !== undefined) baseFeatures.totalSubscriptionMultiple = Number(body.totalSubscriptionMultiple);
      if (body.issueSizeCr !== undefined && body.issueSizeCr > 0) baseFeatures.issueSizeCr = Number(body.issueSizeCr);
      if (body.marketMomentumPct !== undefined) baseFeatures.marketMomentumPct = Number(body.marketMomentumPct);
      if (body.isSme !== undefined) baseFeatures.isSme = Boolean(body.isSme);
    } else {
      const validation = validateIpoFeatures(body);
      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            status: 'INSUFFICIENT_DATA',
            error: `IPO symbol "${cleanSymbol}" is not recognized in market feeds and required features are missing.`,
            missingFields: validation.missingFields,
          },
          { status: 422 }
        );
      }

      baseFeatures = {
        symbol: cleanSymbol,
        companyName: body.companyName || cleanSymbol,
        issuePrice: Number(body.issuePrice) || 100,
        gmp: Number(body.gmp) || 0,
        qibSubscriptionMultiple: Number(body.qibSubscriptionMultiple) || 0,
        niiSubscriptionMultiple: Number(body.niiSubscriptionMultiple) || 0,
        retailSubscriptionMultiple: Number(body.retailSubscriptionMultiple) || 0,
        totalSubscriptionMultiple: Number(body.totalSubscriptionMultiple) || 0,
        issueSizeCr: Number(body.issueSizeCr) || 100,
        marketMomentumPct: Number(body.marketMomentumPct) || 1.2,
        isSme: !!body.isSme,
      };
    }

    const prediction = predictListingGain(baseFeatures);

    return NextResponse.json({
      success: true,
      data: prediction,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: publicErrorMessage(err) }, { status: 500 });
  }
}
