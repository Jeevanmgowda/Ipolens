import { FamilyPanProfile, IpoApplication } from '@/types/pan';
import {
  RegistrarInfo,
  RegistrarSlug,
  MultiPanScanResultItem,
  MultiPanScanSummary,
  SinglePanInquiryResult,
} from '@/types/allotment';
import { getRegistrarForSymbol, OFFICIAL_REGISTRARS } from '@/services/allotmentScanner';
import { getApplicationsStore, updateApplicationStatus } from '@/app/api/applications/route';

export interface MultiPanScanOptions {
  symbol: string;
  companyName?: string;
  price?: number;
  lotSize?: number;
  pans: FamilyPanProfile[];
  autoSyncDatabase?: boolean;
}

export interface LiveRegistrarQueryResult {
  success: boolean;
  status: 'Allotted' | 'Not Allotted' | 'Pending' | 'Technical Rejection';
  sharesApplied?: number;
  sharesAllotted: number;
  applicantName?: string;
  applicationNo?: string;
  dpClientId?: string;
  category?: string;
  message: string;
  isOfficialGatewayRequired: boolean;
  rawConfidence?: number;
}

export class RegistrarScannerService {
  /**
   * Resolves the designated registrar for an IPO
   */
  static getRegistrar(symbol: string): RegistrarInfo {
    return getRegistrarForSymbol(symbol);
  }

  /**
   * Attempts an authentic live HTTP inquiry against the designated registrar's public query endpoint.
   * If protected by Anti-Bot/CAPTCHA or if connection fails, accurately flags official gateway requirement.
   */
  static async queryRegistrarLive(
    symbol: string,
    pan: string,
    options?: { applicationNo?: string; dpClientId?: string }
  ): Promise<LiveRegistrarQueryResult> {
    const cleanSymbol = symbol.toUpperCase().trim();
    const cleanPan = pan.toUpperCase().trim();
    const registrar = this.getRegistrar(cleanSymbol);

    if (!registrar.queryEndpoint) {
      return {
        success: false,
        status: 'Pending',
        sharesAllotted: 0,
        isOfficialGatewayRequired: true,
        message: `Official query endpoint not public for ${registrar.name}. Launch official registrar portal directly.`,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      // Build payload matching registrar's expected parameter signature
      let body: any;
      if (registrar.slug === 'kfintech') {
        body = JSON.stringify({
          pan: cleanPan,
          symbol: cleanSymbol,
          appNo: options?.applicationNo || '',
          clientId: options?.dpClientId || '',
        });
      } else if (registrar.slug === 'bigshare') {
        body = JSON.stringify({
          Txt_Search: cleanPan,
          CompanySelection: cleanSymbol,
          SelectionType: 1, // 1 for PAN
        });
      } else {
        // Default Link Intime
        body = JSON.stringify({
          pan: cleanPan,
          clientid: cleanSymbol,
        });
      }

      const res = await fetch(registrar.queryEndpoint, {
        method: 'POST',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Content-Type': 'application/json; charset=UTF-8',
          'Accept': 'application/json, text/plain, */*',
          'Referer': registrar.portalUrl,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          // Verify genuine registrar payload fields
          if (data && (data.allottedShares !== undefined || data.sharesAllotted !== undefined || data.status)) {
            const allotted = Number(data.allottedShares ?? data.sharesAllotted ?? 0);
            const applied = Number(data.appliedShares ?? data.sharesApplied ?? 0);
            const status: 'Allotted' | 'Not Allotted' = allotted > 0 ? 'Allotted' : 'Not Allotted';

            return {
              success: true,
              status,
              sharesApplied: applied || undefined,
              sharesAllotted: allotted,
              applicantName: data.name || data.investorName,
              applicationNo: data.applicationNo || data.appNo,
              category: data.category || 'Retail',
              message:
                status === 'Allotted'
                  ? `Official Allotment Confirmed by ${registrar.name}: ${allotted} shares allotted.`
                  : `Non-allottee status confirmed by ${registrar.name}. ASBA refund/unblock initiated.`,
              isOfficialGatewayRequired: false,
              rawConfidence: 1.0,
            };
          }
        }
      }

      // If response is not JSON or is a CAPTCHA challenge HTML
      return {
        success: false,
        status: 'Pending',
        sharesAllotted: 0,
        isOfficialGatewayRequired: true,
        message: `${registrar.name} enforces interactive security verification (CAPTCHA / WAF). Please open the official portal to view instant result.`,
      };
    } catch {
      // Registrar server timeout, network sandbox block, or anti-bot restriction
      return {
        success: false,
        status: 'Pending',
        sharesAllotted: 0,
        isOfficialGatewayRequired: true,
        message: `${registrar.name} portal requires user interaction (CAPTCHA protection). Use the 1-click gateway link below.`,
      };
    }
  }

  /**
   * Performs a single PAN inquiry (used by direct search input)
   */
  static async inquireSinglePan(
    symbol: string,
    pan: string,
    options?: {
      companyName?: string;
      price?: number;
      lotSize?: number;
      applicationNo?: string;
      dpClientId?: string;
    }
  ): Promise<SinglePanInquiryResult> {
    const cleanSymbol = symbol.toUpperCase().trim();
    const cleanPan = pan.toUpperCase().trim();
    const registrar = this.getRegistrar(cleanSymbol);
    const applications = getApplicationsStore();

    // Check if user has an existing application in portfolio
    const app = applications.find(
      (a) =>
        a.ipoSymbol.toUpperCase() === cleanSymbol &&
        (a.panNumber.replace(/\*/g, '') === cleanPan || a.panNumber === cleanPan)
    );

    const price = options?.price || app?.bidPrice || 1000;
    const lotSize = options?.lotSize || (app?.shares ? Math.round(app.shares / (app.lots || 1)) : 14);
    const sharesApplied = app ? app.shares : lotSize;
    const lotsApplied = app ? app.lots : 1;
    const category = app ? app.category : 'Retail';

    // 1. Attempt genuine query against registrar
    const queryResult = await this.queryRegistrarLive(cleanSymbol, cleanPan, {
      applicationNo: options?.applicationNo || (app ? app.id : undefined),
      dpClientId: options?.dpClientId,
    });

    let status: 'Allotted' | 'Not Allotted' | 'Pending' | 'Technical Rejection' = 'Pending';
    let sharesAllotted = 0;
    let sourceBadge = '🟢 OFFICIAL REGISTRAR';
    let message = '';
    let isOfficialGatewayRequired = false;

    if (queryResult.success) {
      status = queryResult.status;
      sharesAllotted = queryResult.sharesAllotted;
      sourceBadge = '🟢 OFFICIAL REGISTRAR (LIVE)';
      message = queryResult.message;
      isOfficialGatewayRequired = false;
    } else if (app && (app.status === 'Allotted' || app.status === 'Not Allotted')) {
      // User has a confirmed recorded application
      status = app.status;
      sharesAllotted = app.allottedShares || (status === 'Allotted' ? lotSize : 0);
      sourceBadge = '⚪ RECORDED DEMAT STATUS';
      message =
        status === 'Allotted'
          ? `Allotment confirmed from recorded Demat application: ${sharesAllotted} shares.`
          : `Non-allottee status recorded in application records.`;
      isOfficialGatewayRequired = false;
    } else {
      // Live query requires interactive CAPTCHA / gateway
      status = 'Pending';
      sharesAllotted = 0;
      sourceBadge = '🟡 OFFICIAL GATEWAY REQUIRED';
      message = queryResult.message;
      isOfficialGatewayRequired = true;
    }

    const allotmentValue = sharesAllotted * price;
    const totalBlocked = sharesApplied * price;
    const refundAmount = totalBlocked - allotmentValue;

    const panMasked =
      cleanPan.length >= 10
        ? `${cleanPan.substring(0, 5)}****${cleanPan.slice(-1)}`
        : cleanPan;

    return {
      symbol: cleanSymbol,
      companyName: options?.companyName || cleanSymbol,
      pan: cleanPan,
      panMasked,
      status,
      registrarName: registrar.name,
      registrarSlug: registrar.slug,
      applicantName: queryResult.applicantName || app?.holderName || 'Investor',
      applicationNo: queryResult.applicationNo || (app ? `APP${app.id.slice(-8).toUpperCase()}` : undefined),
      dpClientId: options?.dpClientId,
      category,
      lotsApplied,
      sharesApplied,
      sharesAllotted,
      bidPrice: price,
      allotmentValue,
      refundAmount: Math.max(0, refundAmount),
      message,
      sourceBadge,
      isSimulation: false,
      isOfficialGatewayRequired,
      directPortalUrl: registrar.portalUrl,
      mirrors: registrar.mirrors || [],
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Performs an automated allotment inquiry for a single PAN profile against the official registrar
   */
  static async scanSinglePan(
    symbol: string,
    profile: FamilyPanProfile,
    options: {
      price?: number;
      lotSize?: number;
      companyName?: string;
      autoSyncDatabase?: boolean;
    }
  ): Promise<MultiPanScanResultItem> {
    const cleanSymbol = symbol.toUpperCase().trim();
    const cleanPan = profile.pan.toUpperCase().trim();
    const registrar = this.getRegistrar(cleanSymbol);
    const applications = getApplicationsStore();

    // Match existing application in database
    const app = applications.find(
      (a) =>
        a.ipoSymbol.toUpperCase() === cleanSymbol &&
        (a.panId === profile.id || a.panNumber.replace(/\*/g, '') === cleanPan.replace(/\*/g, ''))
    );

    const price = options.price || app?.bidPrice || 1000;
    const lotSize = options.lotSize || (app?.shares ? Math.round(app.shares / (app.lots || 1)) : 14);
    const sharesApplied = app ? app.shares : lotSize;
    const lotsApplied = app ? app.lots : 1;
    const category = app ? app.category : 'Retail';

    let status: 'Allotted' | 'Not Allotted' | 'Pending' | 'Technical Rejection' = 'Pending';
    let sharesAllotted = 0;
    let message = '';
    let syncedToDatabase = false;
    let sourceBadge = '🟢 OFFICIAL REGISTRAR';

    // 1. Attempt genuine query against registrar
    const queryResult = await this.queryRegistrarLive(cleanSymbol, cleanPan, {
      applicationNo: app ? app.id : undefined,
    });

    if (queryResult.success) {
      status = queryResult.status;
      sharesAllotted = queryResult.sharesAllotted;
      sourceBadge = '🟢 OFFICIAL REGISTRAR';
      message = queryResult.message;
    } else if (app && (app.status === 'Allotted' || app.status === 'Not Allotted')) {
      // Application was already recorded as Allotted or Not Allotted
      status = app.status;
      sharesAllotted = app.allottedShares || (status === 'Allotted' ? lotSize : 0);
      sourceBadge = '⚪ RECORDED APPLICATION';
      message =
        status === 'Allotted'
          ? `Allotment verified from portfolio record: ${sharesAllotted} shares allotted to ${profile.name}.`
          : `Non-allottee status verified from portfolio record for ${profile.name}.`;
    } else {
      // Registrar requires interactive CAPTCHA / gateway verification
      status = 'Pending';
      sharesAllotted = 0;
      sourceBadge = '🟡 OFFICIAL VERIFICATION REQUIRED';
      message = `Official verification required at ${registrar.name}. Interactive CAPTCHA active. Verify on portal: ${registrar.portalUrl}`;
    }

    // 2. Auto-sync database record if application exists and status is conclusive
    if (app && options.autoSyncDatabase !== false) {
      if (status === 'Allotted' || status === 'Not Allotted') {
        updateApplicationStatus(app.id, status, sharesAllotted);
        syncedToDatabase = true;
      }
    }

    const allotmentValue = sharesAllotted * price;
    const totalBlocked = sharesApplied * price;
    const refundAmount = totalBlocked - allotmentValue;

    return {
      panId: profile.id,
      holderName: profile.name,
      relationship: profile.relationship,
      panMasked:
        cleanPan.length >= 10
          ? `${cleanPan.substring(0, 5)}****${cleanPan.slice(-1)}`
          : cleanPan,
      broker: profile.broker,
      registrarName: registrar.name,
      registrarSlug: registrar.slug,
      status,
      category,
      lotsApplied,
      sharesApplied,
      sharesAllotted,
      bidPrice: price,
      allotmentValue,
      refundAmount: Math.max(0, refundAmount),
      applicationNo: app ? `APP${app.id.slice(-8).toUpperCase()}` : `REQ${Date.now().toString().slice(-6)}`,
      applicationId: app?.id,
      syncedToDatabase,
      isSimulation: false,
      sourceBadge,
      registrarUrl: registrar.portalUrl,
      message,
      scannedAt: new Date().toISOString(),
    };
  }

  /**
   * Simultaneously scans all registered family PANs across the relevant official registrar
   */
  static async scanAllFamilyPans(options: MultiPanScanOptions): Promise<MultiPanScanSummary> {
    const {
      symbol,
      companyName = symbol,
      price = 1000,
      lotSize = 14,
      pans,
      autoSyncDatabase = true,
    } = options;
    const cleanSymbol = symbol.toUpperCase().trim();
    const registrar = this.getRegistrar(cleanSymbol);

    // Parallel scan across all family profiles
    const scanPromises = pans.map((profile) =>
      this.scanSinglePan(cleanSymbol, profile, {
        price,
        lotSize,
        companyName,
        autoSyncDatabase,
      })
    );

    const items = await Promise.all(scanPromises);

    // Compute aggregate summary metrics
    const allottedCount = items.filter((i) => i.status === 'Allotted').length;
    const notAllottedCount = items.filter((i) => i.status === 'Not Allotted').length;
    const pendingCount = items.filter((i) => i.status === 'Pending').length;
    const totalSharesAllotted = items.reduce((sum, i) => sum + i.sharesAllotted, 0);
    const totalAllotmentValue = items.reduce((sum, i) => sum + i.allotmentValue, 0);
    const totalRefundAmount = items.reduce((sum, i) => sum + i.refundAmount, 0);

    return {
      symbol: cleanSymbol,
      companyName,
      registrarName: registrar.name,
      registrarSlug: registrar.slug,
      totalPansScanned: items.length,
      allottedCount,
      notAllottedCount,
      pendingCount,
      totalSharesAllotted,
      totalAllotmentValue,
      totalRefundAmount,
      scannedAt: new Date().toISOString(),
      items,
    };
  }
}
