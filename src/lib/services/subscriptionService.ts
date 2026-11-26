import { IpoSubscriptionDetails } from '@/types/liveMarket';

export class SubscriptionService {
  /**
   * Calculates category-wise subscription details and quota proportions
   * for visual cards and progress indicators.
   */
  static getSubscriptionDetails(
    symbol: string,
    companyName: string = symbol,
    totalMultiple: number = 13.82,
    retail?: number,
    nii?: number,
    qib?: number,
    employee?: number
  ): IpoSubscriptionDetails {
    // Use exact exchange multiples or 0 if specific category telemetry is unavailable
    const r = retail !== undefined ? retail : 0;
    const n = nii !== undefined ? nii : 0;
    const q = qib !== undefined ? qib : 0;
    const emp = employee !== undefined ? employee : 0;

    return {
      symbol: symbol.toUpperCase(),
      companyName,
      retail: r,
      nii: n,
      qib: q,
      employee: emp,
      total: totalMultiple,
      totalSharesBid: Math.round(totalMultiple * 3500000),
      recordedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculates visual progress percentage for subscription bars relative to benchmark oversubscription
   */
  static calculateProgressBarPercent(multiple: number, maxThreshold = 25): number {
    if (multiple <= 0) return 0;
    return Math.min(100, Math.round((multiple / maxThreshold) * 100));
  }
}
