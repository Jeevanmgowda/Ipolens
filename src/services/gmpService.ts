import { GmpHistoryPoint, GmpTrendResponse } from '@/types/liveMarket';

export class GmpService {
  private static DISCLAIMER =
    'Grey Market Premium (GMP) is an unofficial, unregulated market indicator. It does NOT represent an official exchange price or a guaranteed listing price.';

  /**
   * Generates realistic, chronological GMP trend history points for any IPO
   * based on its baseline GMP and the requested timeframe.
   */
  static getGmpHistory(
    symbol: string,
    companyName: string = symbol,
    baseGmp: number = 75,
    issuePrice: number = 450,
    timeframe: '1D' | '7D' | '1M' | 'All' = '7D'
  ): GmpTrendResponse {
    let pointCount = 7;
    let stepMs = 24 * 60 * 60 * 1000; // 1 day

    if (timeframe === '1D') {
      pointCount = 12; // Hourly points
      stepMs = 60 * 60 * 1000;
    } else if (timeframe === '7D') {
      pointCount = 7;
      stepMs = 24 * 60 * 60 * 1000;
    } else if (timeframe === '1M') {
      pointCount = 20;
      stepMs = 24 * 60 * 60 * 1000;
    } else if (timeframe === 'All') {
      pointCount = 30;
      stepMs = 24 * 60 * 60 * 1000;
    }

    const now = Date.now();
    const points: GmpHistoryPoint[] = [];

    // Starting baseline GMP earlier in the timeline
    let runningGmp = Math.max(10, Math.round(baseGmp * 0.72));

    for (let i = pointCount - 1; i >= 0; i--) {
      const timeMs = now - i * stepMs;
      const dateObj = new Date(timeMs);

      // Random gentle drift towards the current baseGmp
      const drift = (baseGmp - runningGmp) / (i + 1);
      const randomNoise = (Math.random() - 0.45) * 8;
      const gmpVal = i === 0 ? baseGmp : Math.max(5, Math.round(runningGmp + drift + randomNoise));
      runningGmp = gmpVal;

      const gmpPercent = issuePrice > 0 ? Number(((gmpVal / issuePrice) * 100).toFixed(1)) : 0;
      const estimatedListingPrice = issuePrice + gmpVal;

      const dateLabel = timeframe === '1D'
        ? dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

      points.push({
        date: dateLabel,
        time: dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        timestamp: timeMs,
        gmp: gmpVal,
        gmpPercent,
        estimatedListingPrice,
      });
    }

    const gmpValues = points.map((p) => p.gmp);
    const highestGmp = Math.max(...gmpValues);
    const lowestGmp = Math.min(...gmpValues);
    const currentGmp = points[points.length - 1]?.gmp || baseGmp;
    const startGmp = points[0]?.gmp || baseGmp;
    const gmpChange = currentGmp - startGmp;

    return {
      symbol: symbol.toUpperCase(),
      companyName,
      currentGmp,
      gmpChange,
      highestGmp,
      lowestGmp,
      timeframe,
      points,
      history: points,
      disclaimer: this.DISCLAIMER,
    };
  }
}
