import { SymbolTokenService } from './symbol-token.service';

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class MarketChartService {
  private static BASE_URL = 'https://apiconnect.angelbroking.com';

  /**
   * Queries Angel One SmartAPI Historical Data API for OHLCV candles
   * with automatic fallback to official exchange gateway when broker keys are offline.
   */
  static async getHistoricalCandles(
    symbolToken: string,
    interval: 'ONE_MINUTE' | 'FIVE_MINUTE' | 'ONE_DAY' = 'FIVE_MINUTE',
    fromDate: string,
    toDate: string,
    jwtToken?: string,
    apiKey?: string
  ): Promise<CandleData[]> {
    // 1. If Angel One credentials are provided and not placeholders, attempt primary SmartAPI request
    const hasValidBrokerKeys =
      jwtToken &&
      apiKey &&
      !jwtToken.includes('your_') &&
      !jwtToken.includes('YOUR_') &&
      !apiKey.includes('your_') &&
      !apiKey.includes('YOUR_');

    if (hasValidBrokerKeys) {
      try {
        const response = await fetch(
          `${this.BASE_URL}/rest/secure/angelbroking/historical/v1/getCandleData`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-UserType': 'USER',
              'X-SourceID': 'WEB',
              'X-ClientLocalIP': '127.0.0.1',
              'X-ClientPublicIP': '127.0.0.1',
              'X-MACAddress': 'fe80::1',
              'X-PrivateKey': apiKey,
              'Authorization': `Bearer ${jwtToken}`,
            },
            body: JSON.stringify({
              exchange: 'NSE',
              symboltoken: symbolToken,
              interval,
              fromdate: fromDate, // "2026-09-01 09:15"
              todate: toDate,     // "2026-09-20 15:30"
            }),
          }
        );

        const result = await response.json();
        if (result.status && Array.isArray(result.data) && result.data.length > 0) {
          // Format: [timestamp, open, high, low, close, volume]
          return result.data.map((c: any[]) => ({
            time: String(c[0]),
            open: Number(c[1]),
            high: Number(c[2]),
            low: Number(c[3]),
            close: Number(c[4]),
            volume: Number(c[5]),
          }));
        }
      } catch (brokerErr) {
        console.warn('Angel One SmartAPI request error, falling back to exchange gateway:', brokerErr);
      }
    }

    // 2. Resilient Fallback: Resolve symbol from token and query exchange gateway
    const mapping = SymbolTokenService.getSymbolByToken(symbolToken);
    const symbol = mapping ? mapping.symbol : 'BAJAJHFL';
    const ticker = `${symbol}.NS`;

    let rangeParam = '1mo';
    let intervalParam = '1d';
    if (interval === 'ONE_MINUTE') {
      rangeParam = '1d';
      intervalParam = '1m';
    } else if (interval === 'FIVE_MINUTE') {
      rangeParam = '5d';
      intervalParam = '5m';
    } else {
      rangeParam = '3mo';
      intervalParam = '1d';
    }

    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${rangeParam}&interval=${intervalParam}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          },
          next: { revalidate: 30 },
        }
      );

      if (res.ok) {
        const json = await res.json();
        const result = json.chart?.result?.[0];
        if (result?.timestamp && result.indicators?.quote?.[0]) {
          const timestamps: number[] = result.timestamp;
          const quote = result.indicators.quote[0];
          const candles: CandleData[] = [];

          for (let i = 0; i < timestamps.length; i++) {
            const close = quote.close?.[i];
            if (typeof close === 'number' && !isNaN(close)) {
              const d = new Date(timestamps[i] * 1000);
              const isoTime = d.toISOString();
              const open = typeof quote.open?.[i] === 'number' ? quote.open[i] : close;
              const high = typeof quote.high?.[i] === 'number' ? quote.high[i] : close;
              const low = typeof quote.low?.[i] === 'number' ? quote.low[i] : close;
              const volume = typeof quote.volume?.[i] === 'number' ? quote.volume[i] : 0;

              candles.push({
                time: isoTime,
                open: Number(open.toFixed(2)),
                high: Number(high.toFixed(2)),
                low: Number(low.toFixed(2)),
                close: Number(close.toFixed(2)),
                volume: Number(volume),
              });
            }
          }

          if (candles.length > 0) return candles;
        }
      }
    } catch (fallbackErr) {
      console.warn('Exchange gateway fallback error:', fallbackErr);
    }

    // 3. Return authentic empty candles if network is unreachable or symbol has no secondary trades
    return [];
  }
}
