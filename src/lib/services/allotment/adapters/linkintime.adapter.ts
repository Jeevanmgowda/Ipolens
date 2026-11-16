import { RegistrarSlug, RegistrarServerMirror } from '@/types/allotment';
import { BaseRegistrarAdapter } from './base.adapter';
import { AllotmentAdapterResult, RegistrarQueryOptions } from '../types';

export class LinkIntimeAdapter extends BaseRegistrarAdapter {
  readonly slug: RegistrarSlug = 'linkintime';
  readonly name = 'Link Intime India Pvt Ltd (MUFG)';
  readonly portalUrl = 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html';
  readonly mirrors: RegistrarServerMirror[] = [
    {
      serverName: 'Server 1 (MUFG Investor Portal)',
      url: 'https://in.mpms.mufg.com/Initial_Offer/public-issues.html',
      isPrimary: true,
    },
    {
      serverName: 'Server 2 (Link Intime Legacy Portal)',
      url: 'https://linkintime.co.in/initial_offer/public-issues.html',
    },
    {
      serverName: 'Server 3 (Web Client Download)',
      url: 'https://web.linkintime.co.in/client-downloads/IPO_Status_Allotment.aspx',
    },
  ];

  async checkAllotment(
    symbol: string,
    pan: string,
    options?: RegistrarQueryOptions
  ): Promise<AllotmentAdapterResult> {
    const apiKey = process.env.LINKINTIME_API_KEY;

    // 1. If official B2B API key configured, query official API
    if (apiKey && apiKey.trim().length > 5) {
      try {
        const res = await this.safeFetch('https://api.linkintime.co.in/v1/allotment/inquire', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ symbol, pan }),
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
                  : `Non-allottee status confirmed by ${this.name}. Refund/unblock in progress.`,
              source: 'Link Intime B2B API',
              isOfficialGatewayRequired: false,
              directPortalUrl: this.portalUrl,
              mirrors: this.mirrors,
              checkedAt: new Date().toISOString(),
            };
          }
        }
      } catch (err: any) {
        // Fall through to public endpoint inquiry
      }
    }

    // 2. Query public endpoint
    const queryUrl = 'https://linkintime.co.in/Initial_Offer/IPO.aspx/SearchOnPan';
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
          clientid: symbol,
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
              applicationNo: data.applicationNo,
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

    // 3. Compliant alternative: Link Intime's public portal is gated by Akamai Bot Manager & CAPTCHA.
    // In accordance with guidelines, we do not bypass CAPTCHA. We provide direct mirror links.
    return this.buildInteractiveRequiredResult(
      `${this.name} enforces interactive CAPTCHA & session tokens to protect investor tax IDs. Click the verified official mirror link below to view your instant allotment.`
    );
  }
}

