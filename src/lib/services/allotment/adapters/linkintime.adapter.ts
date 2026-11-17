import { RegistrarSlug, RegistrarServerMirror } from '@/types/allotment';
import { BaseRegistrarAdapter } from './base.adapter';
import { AllotmentAdapterResult, RegistrarQueryOptions } from '../types';

/**
 * MUFG Intime India Private Limited (formerly Link Intime India Pvt Ltd) Allotment Adapter
 * 
 * Rules:
 * 1. Operates under MUFG Pension & Market Services / Corporate Markets.
 * 2. Official portal migrated from linkintime.co.in to https://in.mpms.mufg.com/Initial_Offer/public-issues.html.
 * 3. NO live calls to undocumented web endpoints (SearchOnPan removed).
 * 4. Gated behind official B2B API credentials (MUFG_INTIME_API_KEY / LINKINTIME_API_KEY).
 * 5. Safely falls back to official portal verification with pre-copied PAN shortcut.
 */
export class MufgIntimeAdapter extends BaseRegistrarAdapter {
  readonly slug: RegistrarSlug = 'linkintime';
  readonly name = 'MUFG Intime India Pvt Ltd (formerly Link Intime)';
  readonly portalUrl = 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html';
  readonly mirrors: RegistrarServerMirror[] = [
    {
      serverName: 'Server 1 (MUFG Intime Primary)',
      url: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
      isPrimary: true,
    },
    {
      serverName: 'Server 2 (Dedicated Investor Gateway)',
      url: 'https://idia.in.mpms.mufg.com',
    },
    {
      serverName: 'Server 3 (Legacy Redirect Mirror)',
      url: 'https://linkintime.co.in/initial_offer/public-issues.html',
    },
    {
      serverName: 'Server 4 (Web Client Mirror)',
      url: 'https://web.linkintime.co.in/client-downloads/IPO_Status_Allotment.aspx',
    },
  ];

  get isEnabled(): boolean {
    const key = process.env.MUFG_INTIME_API_KEY || process.env.LINKINTIME_API_KEY;
    return Boolean(key && key.trim().length > 5);
  }

  async checkAllotment(
    symbol: string,
    pan: string,
    options?: RegistrarQueryOptions
  ): Promise<AllotmentAdapterResult> {
    const apiKey = process.env.MUFG_INTIME_API_KEY || process.env.LINKINTIME_API_KEY;
    const apiEndpoint = process.env.MUFG_INTIME_API_ENDPOINT;

    // 1. If official authorized B2B API key and endpoint are configured, execute authorized query
    if (this.isEnabled && apiEndpoint) {
      try {
        const res = await this.safeFetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ symbol, pan, applicationNo: options?.applicationNo }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.sharesAllotted === 'number') {
            const allotted = data.sharesAllotted;
            return {
              status: allotted > 0 ? 'allotted' : 'not_allotted',
              sharesAllotted: allotted,
              sharesApplied: data.sharesApplied,
              applicantName: data.applicantName,
              applicationNo: data.applicationNo,
              category: data.category || 'Retail',
              explanation:
                allotted > 0
                  ? `Official confirmation from ${this.name}: ${allotted} shares allotted.`
                  : `Non-allottee status confirmed by ${this.name}. ASBA refund/unblock initiated.`,
              source: 'MUFG Intime Authorized B2B API',
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

    // 2. Compliant fallback: MUFG Intime enforces interactive captcha and bot defense on in.mpms.mufg.com.
    // In accordance with guidelines, no undocumented scraping or captcha bypasses are executed.
    return this.buildInteractiveRequiredResult(
      `MUFG Intime India Private Limited enforces interactive security verification (captcha & session tokens) on in.mpms.mufg.com. Direct API access is currently gated pending signed registrar authorization. Please use the official 1-click portal link below to check your status.`
    );
  }
}

// Export LinkIntimeAdapter alias for complete backward compatibility across tests and factories
export const LinkIntimeAdapter = MufgIntimeAdapter;
