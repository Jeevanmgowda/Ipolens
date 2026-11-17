import { RegistrarSlug, RegistrarServerMirror } from '@/types/allotment';
import { BaseRegistrarAdapter } from './base.adapter';
import { AllotmentAdapterResult, RegistrarQueryOptions } from '../types';

export class BseGatewayAdapter extends BaseRegistrarAdapter {
  readonly slug: RegistrarSlug = 'other';
  readonly name = 'BSE India Official Allotment Gateway';
  readonly portalUrl = 'https://www.bseindia.com/investors/appli_check.aspx';
  readonly isEnabled = false;
  readonly mirrors: RegistrarServerMirror[] = [
    {
      serverName: 'BSE India Official Checker (Primary)',
      url: 'https://www.bseindia.com/investors/appli_check.aspx',
      isPrimary: true,
    },
    {
      serverName: 'NSE Investor IPO Portal',
      url: 'https://www.nseindia.com/products/content/equities/ipos/ipo_login.htm',
    },
  ];

  async checkAllotment(
    _symbol: string,
    _pan: string,
    _options?: RegistrarQueryOptions
  ): Promise<AllotmentAdapterResult> {
    // BSE India public application check strictly enforces Google reCAPTCHA v2 and session validation.
    // In accordance with security & compliance guidelines, we provide direct 1-click official verification links.
    return {
      status: 'unavailable',
      sharesAllotted: 0,
      explanation:
        'BSE India enforces Google reCAPTCHA v2 and requires selecting Issue Type (Equity) and entering your Application Number or PAN. Click the official BSE India Gateway link below to check your allotment directly.',
      source: 'BSE India Official Gateway',
      isOfficialGatewayRequired: true,
      directPortalUrl: this.portalUrl,
      mirrors: this.mirrors,
      checkedAt: new Date().toISOString(),
    };
  }
}
