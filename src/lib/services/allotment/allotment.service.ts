import { TrustedIpoRegistry } from './trustedIpoRegistry';
import { RegistrarAdapterFactory } from './adapterFactory';
import { allotmentRateLimiter } from './rateLimiter';
import { AllotmentCheckResult, AllotmentStatus, RegistrarQueryOptions } from './types';
import { getApplicationsStore } from '@/app/api/applications/route';

export interface CheckAllotmentRequest {
  symbol: string;
  pan: string;
  clientIp?: string;
  /** Signed-in user; only their own recorded applications are consulted. */
  userId?: string;
  applicationNo?: string;
  dpClientId?: string;
  price?: number;
  lotSize?: number;
}

export class AllotmentService {
  /**
   * Strictly validates PAN format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)
   */
  public static isValidPanFormat(pan: string): boolean {
    if (!pan || typeof pan !== 'string') return false;
    const clean = pan.trim().toUpperCase();
    return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(clean);
  }

  /**
   * Masks a PAN number for secure display (e.g. ABCDE****F).
   * Ensures raw PAN is NEVER exposed in API responses, logs, or metrics.
   */
  public static maskPan(pan: string): string {
    const clean = (pan || '').trim().toUpperCase();
    if (clean.length < 10) return '**********';
    return `${clean.substring(0, 5)}****${clean.slice(-1)}`;
  }

  /**
   * Securely checks allotment status for a given IPO and PAN.
   *
   * Security & Privacy Guarantees:
   * 1. PAN is never persisted to database, file system, or cache.
   * 2. PAN is never logged (only masked PAN is safe for telemetry).
   * 3. Request is rate-limited per client IP.
   * 4. Target IPO is validated against server-side trusted registry (no arbitrary client endpoints).
   * 5. Raw PAN variable is scoped strictly within this function call and discarded immediately.
   */
  public static async checkAllotment(
    request: CheckAllotmentRequest
  ): Promise<{ success: boolean; data?: AllotmentCheckResult; error?: string; status: number }> {
    const { symbol, pan, clientIp = '127.0.0.1', applicationNo, dpClientId, price, lotSize } = request;

    // 1. Rate Limiting Check
    const rateCheck = allotmentRateLimiter.check(clientIp);
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `Too many allotment inquiries from this IP address. Please retry in ${Math.ceil(
          rateCheck.resetMs / 1000
        )} seconds.`,
        status: 429,
      };
    }

    // 2. Validate and Normalize PAN
    if (!pan || typeof pan !== 'string') {
      return {
        success: false,
        error: 'PAN number is required for official allotment verification.',
        status: 400,
      };
    }

    const normalizedPan = pan.trim().toUpperCase();
    if (!this.isValidPanFormat(normalizedPan)) {
      return {
        success: false,
        error: 'Invalid PAN format. Please enter a valid 10-character Indian Permanent Account Number (e.g. ABCDE1234F).',
        status: 400,
      };
    }

    const maskedPan = this.maskPan(normalizedPan);

    // 3. Server-side Validation of Target IPO against Trusted Registry
    const ipoInfo = await TrustedIpoRegistry.validateAndResolveIpo(symbol);
    if (!ipoInfo) {
      return {
        success: false,
        error: `Unknown or unverified IPO symbol: "${symbol}". Only verified public issues may be queried.`,
        status: 400,
      };
    }

    // 4. Resolve Registrar Adapter
    const adapter = RegistrarAdapterFactory.getAdapter(ipoInfo.registrarSlug);

    // 5. Check if user has an existing recorded demat application
    // Only the caller's own applications are considered (never another user's).
    const recordedApplications = request.userId
      ? getApplicationsStore().filter((a) => a.userId === request.userId)
      : [];
    const maskedInput = maskedPan;
    const existingApp = recordedApplications.find(
      (a) => a.ipoSymbol.toUpperCase() === ipoInfo.symbol && (a.panNumber === maskedInput || a.panNumber === normalizedPan)
    );

    const issuePrice = price || ipoInfo.priceHigh || existingApp?.bidPrice || 100;
    const issueLotSize = lotSize || ipoInfo.lotSize || (existingApp?.shares ? Math.round(existingApp.shares / (existingApp.lots || 1)) : 14);
    const sharesApplied = existingApp ? existingApp.shares : issueLotSize;

    // 6. Execute Registrar Query via Adapter
    try {
      const adapterResult = await adapter.checkAllotment(ipoInfo.symbol, normalizedPan, {
        applicationNo: applicationNo || existingApp?.id,
        dpClientId,
        price: issuePrice,
        lotSize: issueLotSize,
      });

      let finalStatus: AllotmentStatus = adapterResult.status;
      let sharesAllotted = adapterResult.sharesAllotted;
      let explanation = adapterResult.explanation;
      let sourceBadge = adapterResult.source;
      let isGatewayRequired = adapterResult.isOfficialGatewayRequired;

      // If adapter returned unavailable / interactive requirement, check if confirmed demat record exists
      if (
        (finalStatus === 'unavailable' || finalStatus === 'pending') &&
        existingApp &&
        (existingApp.status === 'Allotted' || existingApp.status === 'Not Allotted')
      ) {
        finalStatus = existingApp.status === 'Allotted' ? 'allotted' : 'not_allotted';
        sharesAllotted = existingApp.allottedShares || (finalStatus === 'allotted' ? issueLotSize : 0);
        explanation =
          finalStatus === 'allotted'
            ? `Allotment confirmed via verified Demat application record: ${sharesAllotted} shares.`
            : `Non-allottee status recorded in Demat application store. Bank unblock initiated.`;
        sourceBadge = 'Verified Demat Record';
        isGatewayRequired = false;
      }

      const isAllotted = finalStatus === 'allotted';
      const isNotAllotted = finalStatus === 'not_allotted';

      const allotmentValue = isAllotted ? sharesAllotted * issuePrice : 0;
      const totalBlocked = sharesApplied * issuePrice;
      const refundAmount = isNotAllotted
        ? totalBlocked
        : isAllotted
        ? Math.max(0, totalBlocked - allotmentValue)
        : 0; // If pending or unavailable, do NOT assume full refund / non-allotment

      const checkResult: AllotmentCheckResult = {
        symbol: ipoInfo.symbol,
        companyName: ipoInfo.companyName,
        panMasked: maskedPan,
        status: finalStatus,
        sharesAllotted,
        sharesApplied,
        lotSize: issueLotSize,
        bidPrice: issuePrice,
        allotmentValue,
        refundAmount,
        applicantName: adapterResult.applicantName || existingApp?.holderName,
        applicationNo: adapterResult.applicationNo || (existingApp ? `APP${existingApp.id.slice(-8).toUpperCase()}` : undefined),
        dpClientId: adapterResult.dpClientId || dpClientId,
        category: adapterResult.category || existingApp?.category || 'Retail',
        registrarName: ipoInfo.registrarName,
        registrarSlug: ipoInfo.registrarSlug,
        explanation,
        sourceBadge,
        isOfficialGatewayRequired: isGatewayRequired,
        directPortalUrl: adapterResult.directPortalUrl || ipoInfo.portalUrl,
        mirrors: adapterResult.mirrors.length > 0 ? adapterResult.mirrors : ipoInfo.mirrors,
        checkedAt: adapterResult.checkedAt,
      };

      return {
        success: true,
        data: checkResult,
        status: 200,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Registrar communication error: ${err.message || 'Unable to connect to registrar gateway'}`,
        status: 502,
      };
    }
  }
}

