import { RegistrarSlug, RegistrarServerMirror } from '@/types/allotment';
import { AllotmentAdapterResult, AllotmentStatus, RegistrarQueryOptions } from '../types';

export abstract class BaseRegistrarAdapter {
  abstract readonly slug: RegistrarSlug;
  abstract readonly name: string;
  abstract readonly portalUrl: string;
  abstract readonly mirrors: RegistrarServerMirror[];

  /**
   * Performs the allotment inquiry against the registrar's official source.
   * If automated access is gated by CAPTCHA / interactive challenge, returns
   * a compliant 'unavailable' result linking users directly to the official portal.
   */
  abstract checkAllotment(
    symbol: string,
    pan: string,
    options?: RegistrarQueryOptions
  ): Promise<AllotmentAdapterResult>;

  /**
   * Helper to perform safe server-side HTTP request with snappy timeout and no Next.js caching
   */
  protected async safeFetch(
    url: string,
    init: RequestInit,
    timeoutMs: number = 3500
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        cache: 'no-store',
      });
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Builds compliant result when official registrar requires user interactive verification (CAPTCHA / WAF)
   */
  protected buildInteractiveRequiredResult(explanation?: string): AllotmentAdapterResult {
    return {
      status: 'unavailable',
      sharesAllotted: 0,
      explanation:
        explanation ||
        `${this.name} requires interactive security verification (CAPTCHA / Anti-Bot) to protect tax records. Please verify directly via the official 1-click registrar gateway.`,
      source: `Official ${this.name} Portal`,
      isOfficialGatewayRequired: true,
      directPortalUrl: this.portalUrl,
      mirrors: this.mirrors,
      checkedAt: new Date().toISOString(),
    };
  }
}

