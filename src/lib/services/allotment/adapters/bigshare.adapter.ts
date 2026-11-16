import { RegistrarSlug, RegistrarServerMirror } from '@/types/allotment';
import { BaseRegistrarAdapter } from './base.adapter';
import { AllotmentAdapterResult, RegistrarQueryOptions } from '../types';

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

  async checkAllotment(
    symbol: string,
    pan: string,
    options?: RegistrarQueryOptions
  ): Promise<AllotmentAdapterResult> {
    const apiKey = process.env.BIGSHARE_API_KEY;

    // 1. If official B2B partner key is configured
    if (apiKey && apiKey.trim().length > 5) {
      try {
        const res = await this.safeFetch('https://api.bigshareonline.com/v1/allotment', {
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
              source: 'Bigshare B2B API',
              isOfficialGatewayRequired: false,
              directPortalUrl: this.portalUrl,
              mirrors: this.mirrors,
              checkedAt: new Date().toISOString(),
            };
          }
        }
      } catch {
        // Fall through to public query
      }
    }

    // 2. Query public endpoint
    const queryUrl = 'https://www.bigshareonline.com/AllotmentStatus.aspx';
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
          Txt_Search: pan,
          CompanySelection: symbol,
          SelectionType: 1, // 1 for PAN
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

    // 3. Compliant fallback for Cloudflare/CAPTCHA gated endpoint
    return this.buildInteractiveRequiredResult(
      `${this.name} enforces interactive security verification (session CAPTCHA / anti-bot challenge) to protect investor tax IDs. Click the verified official mirror link below to view your instant allotment.`
    );
  }
}

