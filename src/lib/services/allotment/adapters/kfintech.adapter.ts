import { RegistrarSlug, RegistrarServerMirror } from '@/types/allotment';
import { BaseRegistrarAdapter } from './base.adapter';
import { AllotmentAdapterResult, RegistrarQueryOptions } from '../types';

/**
 * KFin Technologies Limited Allotment Adapter
 * 
 * Rules:
 * 1. Official portal: https://kosmic.kfintech.com/ipostatus/
 * 2. NO live calls to undocumented web endpoints (IPOStatus scraping removed).
 * 3. Gated behind official B2B API credentials (KFINTECH_API_KEY).
 * 4. Safely falls back to official Kosmic portal verification with pre-copied PAN shortcut.
 */
export class KFintechAdapter extends BaseRegistrarAdapter {
  readonly slug: RegistrarSlug = 'kfintech';
  readonly name = 'KFin Technologies Limited';
  readonly portalUrl = 'https://kosmic.kfintech.com/ipostatus/';
  readonly mirrors: RegistrarServerMirror[] = [
    {
      serverName: 'Server 1 (Kosmic Primary)',
      url: 'https://kosmic.kfintech.com/ipostatus/',
      isPrimary: true,
    },
    {
      serverName: 'Server 2 (RIS KFintech)',
      url: 'https://ris.kfintech.com/ipostatus/',
    },
    {
      serverName: 'Server 3 (KPrism Mirror)',
      url: 'https://kprism.kfintech.com/ipostatus/',
    },
    {
      serverName: 'Server 4 (Direct Domain)',
      url: 'https://ipostatus.kfintech.com/',
    },
  ];

  get isEnabled(): boolean {
    const key = process.env.KFINTECH_API_KEY;
    return Boolean(key && key.trim().length > 5);
  }

  async checkAllotment(
    symbol: string,
    pan: string,
    options?: RegistrarQueryOptions
  ): Promise<AllotmentAdapterResult> {
    const apiKey = process.env.KFINTECH_API_KEY;
    const apiEndpoint = process.env.KFINTECH_API_ENDPOINT;

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
            clientId: options?.dpClientId,
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
              source: 'KFintech Authorized B2B API',
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

    // 2. Compliant fallback: KFintech enforces interactive captcha / anti-bot challenge on kosmic.kfintech.com.
    // In accordance with guidelines, no undocumented scraping or captcha bypasses are executed.
    return this.buildInteractiveRequiredResult(
      `KFin Technologies enforces interactive security verification (math captcha / anti-bot challenge) on kosmic.kfintech.com to protect taxpayer records. Direct API access is currently gated pending signed registrar authorization. Please use the official 1-click portal link below to check your status.`
    );
  }
}
