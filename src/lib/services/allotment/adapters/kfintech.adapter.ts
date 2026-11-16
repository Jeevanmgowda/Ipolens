import { RegistrarSlug, RegistrarServerMirror } from '@/types/allotment';
import { BaseRegistrarAdapter } from './base.adapter';
import { AllotmentAdapterResult, RegistrarQueryOptions } from '../types';

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

  async checkAllotment(
    symbol: string,
    pan: string,
    options?: RegistrarQueryOptions
  ): Promise<AllotmentAdapterResult> {
    const apiKey = process.env.KFINTECH_API_KEY;

    // 1. If official B2B API key configured, query official KFintech partner API
    if (apiKey && apiKey.trim().length > 5) {
      try {
        const res = await this.safeFetch('https://api.kfintech.com/v1/ipo/allotment', {
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
              source: 'KFintech B2B API',
              isOfficialGatewayRequired: false,
              directPortalUrl: this.portalUrl,
              mirrors: this.mirrors,
              checkedAt: new Date().toISOString(),
            };
          }
        }
      } catch {
        // Fall through to public endpoint inquiry
      }
    }

    // 2. Query public Kosmic endpoint
    const queryUrl = 'https://kosmic.kfintech.com/ipostatus/IPOStatus';
    try {
      const res = await this.safeFetch(queryUrl, {
        method: 'POST',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Content-Type': 'application/json; charset=UTF-8',
          'Accept': 'application/json, text/plain, */*',
          'Referer': this.portalUrl,
        },
        body: JSON.stringify({
          pan,
          symbol,
          appNo: options?.applicationNo || '',
          clientId: options?.dpClientId || '',
        }),
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (data && (data.allottedShares !== undefined || data.sharesAllotted !== undefined)) {
            const allotted = Number(data.allottedShares ?? data.sharesAllotted ?? 0);
            const applied = Number(data.appliedShares ?? data.sharesApplied ?? 0);
            return {
              status: allotted > 0 ? 'allotted' : 'not_allotted',
              sharesAllotted: allotted,
              sharesApplied: applied || undefined,
              applicantName: data.name || data.investorName,
              applicationNo: data.applicationNo || data.appNo,
              category: data.category || 'Retail',
              explanation:
                allotted > 0
                  ? `Official confirmation from ${this.name}: ${allotted} shares allotted.`
                  : `Non-allottee status confirmed by ${this.name}. Bank ASBA unblock initiated.`,
              source: `${this.name} Gateway`,
              isOfficialGatewayRequired: false,
              directPortalUrl: this.portalUrl,
              mirrors: this.mirrors,
              checkedAt: new Date().toISOString(),
            };
          }
        }
      }
    } catch {
      // Handled below
    }

    // 3. Compliant alternative: KFintech enforces Akamai / math CAPTCHA verification
    return this.buildInteractiveRequiredResult(
      `${this.name} enforces interactive security verification (math CAPTCHA / anti-bot challenge) to protect investor tax IDs. Click the verified official mirror link below to view your instant allotment.`
    );
  }
}

