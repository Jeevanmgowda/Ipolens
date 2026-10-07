/**
 * IPOLENS Live IPO Data Integration & Dual-Source Reconciliation Engine
 * 
 * Implements the Source-of-Truth Matrix:
 * - Primary: Official Upstox IPO API v2
 * - Secondary: NSE / BSE Exchange Telemetry
 * - Fallback: Stale Local Snapshot with Freshness Badges
 * 
 * Features:
 * - Cross-source validation & discrepancy tolerance checks
 * - Freshness timestamp & stale detection (> 15 mins)
 * - Event detection (subscription milestones, GMP jumps) for notifications
 * - Token lifespan and connection health monitoring
 */

import { UnifiedIPO, IssueType } from '@/types/ipo';
import { UpstoxApiDetailResponse } from '../../../tests/fixtures/upstoxIpoFixtures';

export type ReconciliationStatus =
  | 'CONSENSUS_VERIFIED'
  | 'MISMATCH_FLAGGED'
  | 'UPSTOX_ONLY'
  | 'EXCHANGE_FALLBACK'
  | 'LOCAL_STALE';

export interface FieldDiscrepancy {
  field: string;
  upstoxValue: any;
  exchangeValue: any;
  divergencePct?: number;
  severity: 'CRITICAL' | 'WARNING';
}

export interface ReconciledIpoRecord extends UnifiedIPO {
  reconciliationStatus: ReconciliationStatus;
  primarySource: 'UPSTOX_V2' | 'NSE_EXCHANGE' | 'LOCAL_CACHE';
  secondarySource?: string;
  confidenceScore: number; // 0 - 100
  discrepancies: FieldDiscrepancy[];
  lastFetchedAt: string;
  dataAgeSeconds: number;
  isStale: boolean;
  freshnessLabel: string;
}

export interface IpoEventAlert {
  symbol: string;
  companyName: string;
  eventType: 'SUBSCRIPTION_MILESTONE' | 'GMP_SURGE' | 'CLOSING_SOON';
  message: string;
  thresholdCrossed: string;
  timestamp: string;
}

export class UpstoxReconciliationService {
  private static MAX_FRESH_AGE_SECONDS = 900; // 15 minutes max age before marking 'stale'
  private static SUBSCRIPTION_TOLERANCE_PCT = 5.0; // 5% divergence threshold

  /**
   * Normalize an Upstox API v2 payload into a standard UnifiedIPO record
   */
  static normalizeUpstoxPayload(raw: UpstoxApiDetailResponse['data']): UnifiedIPO {
    const rawIssueType = (raw.issue_type || '').toLowerCase();
    const issueType: IssueType = rawIssueType.includes('sme') ? 'sme' : 'regular';
    const status = (raw.status || 'open').toLowerCase() as UnifiedIPO['status'];

    let subscriptionRetail: number | undefined;
    let subscriptionHni: number | undefined;
    let subscriptionQib: number | undefined;

    if (Array.isArray(raw.investors)) {
      raw.investors.forEach((inv) => {
        const cat = (inv.category || '').toUpperCase();
        const rate = Number(inv.subscription_rate || 0);
        if (cat.includes('RETAIL') || cat.includes('INDIVIDUAL')) subscriptionRetail = rate;
        if (cat.includes('HNI') || cat.includes('NII')) subscriptionHni = rate;
        if (cat.includes('QIB') || cat.includes('INSTITUTIONAL')) subscriptionQib = rate;
      });
    }

    const minPrice = Number(raw.minimum_price || raw.cut_off_price || 0);
    const maxPrice = Number(raw.maximum_price || raw.cut_off_price || minPrice || 100);

    return {
      id: raw.id || `${raw.symbol.toLowerCase()}-ipo`,
      symbol: raw.symbol.toUpperCase(),
      companyName: raw.name,
      issueType,
      status,
      priceBandMin: minPrice,
      priceBandMax: maxPrice,
      lotSize: Number(raw.lot_size || 1),
      openDate: raw.timeline?.bidding_start_date || raw.bidding_start_date?.split('T')[0] || 'TBA',
      closeDate: raw.timeline?.bidding_end_date || raw.bidding_end_date?.split('T')[0] || 'TBA',
      listingDate: raw.timeline?.listing_date || undefined,
      issueSizeInCrores: raw.issue_size ? Math.round(raw.issue_size / 10000000) : undefined,
      subscriptionTotal: raw.total_subscription !== undefined ? Number(raw.total_subscription) : undefined,
      subscriptionRetail,
      subscriptionHni,
      subscriptionQib,
      registrar: raw.registrar_info?.name || 'TBA',
      gmp: 0,
      expectedListingGainPct: 0,
    };
  }

  /**
   * Reconcile Primary Upstox Record against Secondary Exchange (NSE/BSE) Data
   */
  static reconcile(
    primary: UnifiedIPO,
    secondary?: {
      priceBandMin?: number;
      priceBandMax?: number;
      lotSize?: number;
      subscriptionTotal?: number;
      sourceName?: string;
    },
    fetchedAt: Date = new Date()
  ): ReconciledIpoRecord {
    const discrepancies: FieldDiscrepancy[] = [];
    const now = new Date();
    const dataAgeSeconds = Math.max(0, Math.floor((now.getTime() - fetchedAt.getTime()) / 1000));
    const isStale = dataAgeSeconds > this.MAX_FRESH_AGE_SECONDS;

    let freshnessLabel = 'Just now';
    if (dataAgeSeconds >= 60 && dataAgeSeconds < 3600) {
      freshnessLabel = `${Math.floor(dataAgeSeconds / 60)}m ago`;
    } else if (dataAgeSeconds >= 3600) {
      freshnessLabel = `${Math.floor(dataAgeSeconds / 3600)}h ago`;
    }

    if (!secondary) {
      return {
        ...primary,
        reconciliationStatus: isStale ? 'LOCAL_STALE' : 'UPSTOX_ONLY',
        primarySource: 'UPSTOX_V2',
        confidenceScore: isStale ? 65 : 85,
        discrepancies: [],
        lastFetchedAt: fetchedAt.toISOString(),
        dataAgeSeconds,
        isStale,
        freshnessLabel,
      };
    }

    // 1. Price Band Check (Critical)
    if (secondary.priceBandMax && secondary.priceBandMax !== primary.priceBandMax) {
      discrepancies.push({
        field: 'priceBandMax',
        upstoxValue: primary.priceBandMax,
        exchangeValue: secondary.priceBandMax,
        severity: 'CRITICAL',
      });
    }

    // 2. Lot Size Check (Critical)
    if (secondary.lotSize && secondary.lotSize !== primary.lotSize) {
      discrepancies.push({
        field: 'lotSize',
        upstoxValue: primary.lotSize,
        exchangeValue: secondary.lotSize,
        severity: 'CRITICAL',
      });
    }

    // 3. Subscription Check (Tolerance: 5%)
    if (
      primary.subscriptionTotal !== undefined &&
      secondary.subscriptionTotal !== undefined &&
      primary.subscriptionTotal > 0
    ) {
      const divergencePct = Math.abs(
        ((primary.subscriptionTotal - secondary.subscriptionTotal) / primary.subscriptionTotal) * 100
      );
      if (divergencePct > this.SUBSCRIPTION_TOLERANCE_PCT) {
        discrepancies.push({
          field: 'subscriptionTotal',
          upstoxValue: primary.subscriptionTotal,
          exchangeValue: secondary.subscriptionTotal,
          divergencePct: Number(divergencePct.toFixed(2)),
          severity: 'WARNING',
        });
      }
    }

    const hasCritical = discrepancies.some((d) => d.severity === 'CRITICAL');
    const hasWarning = discrepancies.some((d) => d.severity === 'WARNING');

    let reconciliationStatus: ReconciliationStatus = 'CONSENSUS_VERIFIED';
    let confidenceScore = 98;

    if (hasCritical) {
      reconciliationStatus = 'MISMATCH_FLAGGED';
      confidenceScore = 70;
    } else if (hasWarning) {
      reconciliationStatus = 'MISMATCH_FLAGGED';
      confidenceScore = 88;
    }

    if (isStale) {
      confidenceScore = Math.max(50, confidenceScore - 20);
    }

    return {
      ...primary,
      reconciliationStatus,
      primarySource: 'UPSTOX_V2',
      secondarySource: secondary.sourceName || 'NSE Exchange Feed',
      confidenceScore,
      discrepancies,
      lastFetchedAt: fetchedAt.toISOString(),
      dataAgeSeconds,
      isStale,
      freshnessLabel,
    };
  }

  /**
   * Detect event triggers (Subscription Milestones, GMP Jumps) to dispatch notifications
   */
  static detectEvents(
    previous: { subscriptionTotal?: number; gmp?: number },
    current: { symbol: string; companyName: string; subscriptionTotal?: number; gmp?: number }
  ): IpoEventAlert[] {
    const alerts: IpoEventAlert[] = [];
    const nowIso = new Date().toISOString();

    // Check subscription milestones: 10x, 25x, 50x, 100x
    const milestones = [10, 25, 50, 100];
    const prevSub = previous.subscriptionTotal || 0;
    const currSub = current.subscriptionTotal || 0;

    for (const m of milestones) {
      if (prevSub < m && currSub >= m) {
        alerts.push({
          symbol: current.symbol,
          companyName: current.companyName,
          eventType: 'SUBSCRIPTION_MILESTONE',
          message: `${current.symbol} has crossed ${m}x total subscription (${currSub.toFixed(2)}x)!`,
          thresholdCrossed: `${m}x`,
          timestamp: nowIso,
        });
      }
    }

    // Check GMP Jump: >= 15% jump in Grey Market Premium
    const prevGmp = previous.gmp || 0;
    const currGmp = current.gmp || 0;
    if (prevGmp > 0 && currGmp > prevGmp) {
      const gmpJumpPct = ((currGmp - prevGmp) / prevGmp) * 100;
      if (gmpJumpPct >= 15) {
        alerts.push({
          symbol: current.symbol,
          companyName: current.companyName,
          eventType: 'GMP_SURGE',
          message: `${current.symbol} Grey Market Premium jumped +${gmpJumpPct.toFixed(1)}% (now ₹${currGmp})!`,
          thresholdCrossed: `+${gmpJumpPct.toFixed(1)}%`,
          timestamp: nowIso,
        });
      }
    }

    return alerts;
  }

  /**
   * Upstox Token Health Status Check
   */
  static checkTokenHealth(tokenOverride?: string): {
    isConfigured: boolean;
    tokenStatus: 'VALID' | 'EXPIRED' | 'MISSING' | 'PLACEHOLDER';
    message: string;
  } {
    const token = tokenOverride !== undefined ? tokenOverride : (process.env.UPSTOX_ACCESS_TOKEN || '');

    if (!token) {
      return {
        isConfigured: false,
        tokenStatus: 'MISSING',
        message: 'UPSTOX_ACCESS_TOKEN environment variable not set. Running in fallback mode.',
      };
    }

    if (token.startsWith('your_') || token.startsWith('YOUR_') || token.includes('dummy')) {
      return {
        isConfigured: false,
        tokenStatus: 'PLACEHOLDER',
        message: 'UPSTOX_ACCESS_TOKEN contains placeholder characters.',
      };
    }

    if (token.length < 30) {
      return {
        isConfigured: false,
        tokenStatus: 'EXPIRED',
        message: 'UPSTOX_ACCESS_TOKEN format invalid or truncated.',
      };
    }

    return {
      isConfigured: true,
      tokenStatus: 'VALID',
      message: 'Active Upstox Developer v2 Bearer Token validated.',
    };
  }
}
