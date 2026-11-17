import { RegistrarSlug, RegistrarServerMirror } from '@/types/allotment';
import { AllotmentAdapterResult, IRegistrarAdapter, RegistrarQueryOptions } from '../types';

export abstract class BaseRegistrarAdapter implements IRegistrarAdapter {
  abstract readonly slug: RegistrarSlug;
  abstract readonly name: string;
  abstract readonly portalUrl: string;
  abstract readonly mirrors: RegistrarServerMirror[];
  abstract readonly isEnabled: boolean;

  /**
   * Performs the allotment inquiry against the registrar's official source.
   * If automated access is disabled or gated by CAPTCHA / authorization requirements,
   * returns a compliant 'unavailable' result linking users directly to the official portal.
   */
  abstract checkAllotment(
    symbol: string,
    pan: string,
    options?: RegistrarQueryOptions
  ): Promise<AllotmentAdapterResult>;

  /**
   * Helper to perform safe server-side HTTP request with snappy timeout and no Next.js caching.
   * Strictly used only when authorized B2B API endpoints and credentials are provided.
   */
  protected async safeFetch(
    url: string,
    init: RequestInit,
    timeoutMs: number = 4000
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
   * Builds compliant result when official registrar requires user interactive verification or
   * when live direct API integration is pending authorization.
   */
  protected buildInteractiveRequiredResult(explanation?: string): AllotmentAdapterResult {
    return {
      status: 'unavailable',
      sharesAllotted: 0,
      explanation:
        explanation ||
        `Direct automated inquiry for ${this.name} is currently gated pending authorized B2B registrar API integration. Please verify your allotment directly on the official registrar portal.`,
      source: `Official ${this.name} Portal`,
      isOfficialGatewayRequired: true,
      directPortalUrl: this.portalUrl,
      mirrors: this.mirrors,
      checkedAt: new Date().toISOString(),
    };
  }
}
