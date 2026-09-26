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
    // If specific category multiples are not provided, synthesize realistic SEBI book proportions
    const r = retail ?? Number((totalMultiple * 0.65).toFixed(2));
    const n = nii ?? Number((totalMultiple * 1.05).toFixed(2));
    const q = qib ?? Number((totalMultiple * 1.55).toFixed(2));
    const emp = employee ?? Number((Math.min(5, totalMultiple * 0.15)).toFixed(2));

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
