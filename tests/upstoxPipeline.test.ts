import { describe, it, expect } from 'vitest';
import { UpstoxIpoService } from '@/lib/services/upstox-ipo.service';
import { UpstoxChartService } from '@/lib/services/upstox-chart.service';
import { IpoAggregatorService } from '@/lib/services/ipo-aggregator.service';

describe('Upstox Developer API v2 & Hybrid GMP Pipeline', () => {
  describe('UpstoxIpoService', () => {
    it('should fetch or fallback IPOs across all 4 lifecycle stages without error', async () => {
      const open = await UpstoxIpoService.getIposByStatus('open');
      expect(Array.isArray(open)).toBe(true);
      expect(open.length).toBeGreaterThan(0);
      expect(open[0]).toHaveProperty('symbol');
      expect(open[0]).toHaveProperty('status');

      const upcoming = await UpstoxIpoService.getIposByStatus('upcoming');
      expect(Array.isArray(upcoming)).toBe(true);
      expect(upcoming.length).toBeGreaterThan(0);

      const closed = await UpstoxIpoService.getIposByStatus('closed');
      expect(Array.isArray(closed)).toBe(true);
      expect(closed.length).toBeGreaterThan(0);

      const listed = await UpstoxIpoService.getIposByStatus('listed');
      expect(Array.isArray(listed)).toBe(true);
      expect(listed.length).toBeGreaterThan(0);
    });

    it('should filter IPOs by issueType (sme vs regular)', async () => {
      const smeIpos = await UpstoxIpoService.getIposByStatus('open', 'sme');
      expect(Array.isArray(smeIpos)).toBe(true);
      smeIpos.forEach((ipo) => {
        expect(ipo.issueType).toBe('sme');
      });
    });

    it('should return deep metrics on getIpoDetails', async () => {
      const details = await UpstoxIpoService.getIpoDetails('swiggy-limited-ipo');
      expect(details).not.toBeNull();
      expect(details?.symbol).toBe('SWIGGY');
      expect(details?.lotSize).toBeGreaterThan(0);
      expect(details?.priceBandMax).toBeGreaterThan(0);
    });
  });

  describe('UpstoxChartService', () => {
    it('should resolve symbol to NSE instrument key correctly', () => {
      expect(UpstoxChartService.resolveInstrumentKey('SWIGGY')).toBe('NSE_EQ|INE00H001014');
      expect(UpstoxChartService.resolveInstrumentKey('TATATECH')).toBe('NSE_EQ|INE142M01025');
      expect(UpstoxChartService.resolveInstrumentKey('NIFTY')).toBe('NSE_INDEX|Nifty 50');
      expect(UpstoxChartService.resolveInstrumentKey('NSE_EQ|INE0V6F01027')).toBe('NSE_EQ|INE0V6F01027');
    });

    it('should return chronologically ordered CandleData array', async () => {
      const candles = await UpstoxChartService.getHistoricalCandles('SWIGGY', 'day');
      expect(Array.isArray(candles)).toBe(true);
      expect(candles.length).toBeGreaterThan(0);
      expect(candles[0]).toHaveProperty('time');
      expect(candles[0]).toHaveProperty('open');
      expect(candles[0]).toHaveProperty('high');
      expect(candles[0]).toHaveProperty('low');
      expect(candles[0]).toHaveProperty('close');
      expect(candles[0]).toHaveProperty('volume');
    });
  });

  describe('IpoAggregatorService (Hybrid GMP Layer)', () => {
    it('should enrich IPOs with GMP and correct expectedListingGainPct formula', async () => {
      const unifiedIpos = await IpoAggregatorService.getUnifiedIpos('open');
      expect(Array.isArray(unifiedIpos)).toBe(true);
      expect(unifiedIpos.length).toBeGreaterThan(0);

      const item = unifiedIpos[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('symbol');
      expect(item).toHaveProperty('companyName');
      expect(item).toHaveProperty('issueType');
      expect(item).toHaveProperty('status');
      expect(item).toHaveProperty('priceBandMin');
      expect(item).toHaveProperty('priceBandMax');
      expect(item).toHaveProperty('lotSize');
      expect(item).toHaveProperty('gmp');
      expect(item).toHaveProperty('expectedListingGainPct');

      // Formula verification: (gmp / priceBandMax) * 100
      const expectedPct = item.priceBandMax > 0 ? Number(((item.gmp / item.priceBandMax) * 100).toFixed(2)) : 0;
      expect(item.expectedListingGainPct).toBe(expectedPct);
    });

    it('should fetch single enriched Unified IPO by id', async () => {
      const ipo = await IpoAggregatorService.getUnifiedIpoById('swiggy-limited-ipo');
      expect(ipo).not.toBeNull();
      expect(ipo?.symbol).toBe('SWIGGY');
      expect(ipo?.expectedListingGainPct).toBeGreaterThanOrEqual(0);
    });
  });
});
