import { RegistrarSlug, RegistrarServerMirror } from '@/types/allotment';
import { BaseRegistrarAdapter } from './base.adapter';
import { AllotmentAdapterResult, RegistrarQueryOptions } from '../types';

/**
 * Bigshare Services Pvt Ltd Allotment Adapter
 * 
 * Rules:
 * 1. Official portal: https://www.bigshareonline.com/ipo_Allotment.html
 * 2. NO live calls to undocumented web endpoints (AllotmentStatus.aspx scraping removed).
 * 3. Gated behind official B2B API credentials (BIGSHARE_API_KEY).
 * 4. Safely falls back to official Bigshare portal verification with pre-copied PAN shortcut.
 */
export class BigshareAdapter extends BaseRegistrarAdapter {
  readonly slug: RegistrarSlug = 'bigshare';
  readonly name = 'Bigshare Services Pvt Ltd';
  readonly portalUrl = 'https://www.bigshareonline.com/ipo_Allotment.html';
  readonly mirrors: RegistrarServerMirror[] = [
    {
      serverName: 'Server 1 (Bigshare Main)',
      url: 'https://www.bigshareonline.com/ipo_Allotment.html',
      isPrimary: true,
    },
    {
      serverName: 'Server 2 (IPO Dedicated Mirror)',
      url: 'https://ipo.bigshareonline.com/',
    },
    {
      serverName: 'Server 3 (High-Traffic Mirror)',
      url: 'https://ipo2.bigshareonline.com/',
    },
  ];

  get isEnabled(): boolean {
    const key = process.env.BIGSHARE_API_KEY;
    return Boolean(key && key.trim().length > 5);
  }

  async checkAllotment(
    symbol: string,
    pan: string,
    options?: RegistrarQueryOptions
  ): Promise<AllotmentAdapterResult> {
    const apiKey = process.env.BIGSHARE_API_KEY;
    const apiEndpoint = process.env.BIGSHARE_API_ENDPOINT;

    // 1. If official authorized B2B API key and endpoint are configured, execute authorized query
    if (this.isEnabled && apiEndpoint) {
      try {
        const res = await this.safeFetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            symbol,
            pan,
            applicationNo: options?.applicationNo,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.sharesAllotted === 'number') {
            const allotted = data.sharesAllotted;
            return {
              status: allotted > 0 ? 'allotted' : 'not_allotted',
              sharesAllotted: allotted,
              sharesApplied: data.sharesApplied,
              applicantName: data.applicantName || data.name,
              applicationNo: data.applicationNo,
              category: data.category || 'Retail',
              explanation:
                allotted > 0
                  ? `Official confirmation from ${this.name}: ${allotted} shares allotted.`
                  : `Non-allottee status confirmed by ${this.name}. Bank ASBA unblock initiated.`,
              source: 'Bigshare Authorized B2B API',
              isOfficialGatewayRequired: false,
              directPortalUrl: this.portalUrl,
              mirrors: this.mirrors,
              checkedAt: new Date().toISOString(),
            };
          }
        }
      } catch {
        // Fall through to compliant fallback result
      }
    }

    // 2. Compliant fallback: Bigshare Services enforces session captcha / anti-bot challenge.
    // In accordance with guidelines, no undocumented scraping or captcha bypasses are executed.
    return this.buildInteractiveRequiredResult(
      `Bigshare Services enforces interactive security verification (session captcha / anti-bot challenge) to protect investor tax IDs. Direct API access is currently gated pending signed registrar authorization. Please use the official 1-click portal link below to check your status.`
    );
  }
}
