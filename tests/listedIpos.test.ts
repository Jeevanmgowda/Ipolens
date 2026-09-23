import { describe, it, expect } from 'vitest';
import {
  fetchLiveListedIpos,
  fetchLiveIpoChart,
  LISTED_IPOS_REGISTRY,
} from '../src/services/listedIpoService';

describe('Listed IPO Live Service', () => {
  it('should return metadata registry of popular landmark listed IPOs', () => {
    expect(LISTED_IPOS_REGISTRY.length).toBeGreaterThanOrEqual(15);
    const bajaj = LISTED_IPOS_REGISTRY.find((i) => i.symbol === 'BAJAJHFL');
    expect(bajaj).toBeDefined();
    expect(bajaj?.issuePrice).toBe(70);
    expect(bajaj?.series).toBe('EQ');

    const krn = LISTED_IPOS_REGISTRY.find((i) => i.symbol === 'KRN');
    expect(krn).toBeDefined();
    expect(krn?.issuePrice).toBe(220);
  });

  it('should fetch live secondary market quotes with calculated gain metrics', async () => {
    const data = await fetchLiveListedIpos();
    expect(data.length).toBeGreaterThanOrEqual(15);

    for (const item of data) {
      expect(item.symbol).toBeTruthy();
      expect(item.companyName).toBeTruthy();
      expect(item.currentPrice).toBeGreaterThan(0);
      expect(item.issuePrice).toBeGreaterThan(0);
      expect(typeof item.totalGainPercent).toBe('number');
      expect(typeof item.dayChange).toBe('number');
      expect(typeof item.dayChangePercent).toBe('number');
      expect(item.fiftyTwoWeekHigh).toBeGreaterThanOrEqual(item.fiftyTwoWeekLow);
    }
  }, 15000);

  it('should fetch live chart candle points for a listed IPO symbol', async () => {
    const chart = await fetchLiveIpoChart('BAJAJHFL', '1mo');
    expect(chart).toBeDefined();
    expect(chart?.symbol).toBe('BAJAJHFL');
    expect(chart?.range).toBe('1mo');
    expect(chart?.currentPrice).toBeGreaterThan(0);
    expect(chart?.points.length).toBeGreaterThan(0);

    const firstPoint = chart!.points[0];
    expect(firstPoint.timestamp).toBeGreaterThan(0);
    expect(firstPoint.price).toBeGreaterThan(0);
    expect(firstPoint.date).toBeTruthy();
  }, 15000);
});
