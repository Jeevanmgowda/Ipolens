import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IpoService } from '../src/services/ipoService';
import { MarketService } from '../src/services/marketService';
import { GmpService } from '../src/services/gmpService';
import { SubscriptionService } from '../src/services/subscriptionService';
import { MockMarketProvider, UpstoxProvider } from '../src/services/marketDataProvider';
import { MockIPOProvider, NSEIPOProvider } from '../src/services/ipoDataProvider';
import {
  iposTable,
  ipoSubscriptionsTable,
  ipoGmpHistoryTable,
  marketQuotesTable,
  marketOhlcTable,
  marketWatchlistTable,
} from '../src/db/schema';

describe('Live Market Feature Test Suite', () => {
  const originalEnv = process.env.USE_MOCK_MARKET_DATA;

  beforeEach(() => {
    process.env.USE_MOCK_MARKET_DATA = 'true';
  });

  afterEach(() => {
    process.env.USE_MOCK_MARKET_DATA = originalEnv;
  });

  describe('Database Schema Extensions', () => {
    it('should define all required Live Market tables in Drizzle schema', () => {
      expect(iposTable).toBeDefined();
      expect(ipoSubscriptionsTable).toBeDefined();
      expect(ipoGmpHistoryTable).toBeDefined();
      expect(marketQuotesTable).toBeDefined();
      expect(marketOhlcTable).toBeDefined();
      expect(marketWatchlistTable).toBeDefined();
    });
  });

  describe('Mock Data Provider & Free-Development Mode', () => {
    it('should generate realistic mock market quotes with Indian market constraints', async () => {
      const mockMarket = new MockMarketProvider();
      const quote = await mockMarket.getQuote('DEMOTECH');

      expect(quote).toBeDefined();
      expect(quote.symbol).toBe('DEMOTECH');
      expect(quote.ltp).toBeGreaterThan(0);
      expect(quote.high).toBeGreaterThanOrEqual(quote.low);
      expect(quote.volume).toBeGreaterThan(0);
      expect(quote.isMock).toBe(true);
      expect(quote.timestamp).toBeTruthy();
    });

    it('should generate multi-timeframe OHLC candle bars with consistent math', async () => {
      const mockMarket = new MockMarketProvider();
      const timeframes = ['1m', '5m', '15m', '30m', '1H', '1D', '1W', '1M'] as const;

      for (const tf of timeframes) {
        const candles = await mockMarket.getOhlc('DEMOTECH', tf);
        expect(candles.length).toBeGreaterThan(0);

        for (const candle of candles) {
          expect(candle.timestamp).toBeGreaterThan(0);
          expect(candle.high).toBeGreaterThanOrEqual(candle.low);
          expect(candle.high).toBeGreaterThanOrEqual(Math.min(candle.open, candle.close));
          expect(candle.low).toBeLessThanOrEqual(Math.max(candle.open, candle.close));
          expect(candle.volume).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should provide realistic demo IPO data matching specifications', async () => {
      const mockIpo = new MockIPOProvider();
      const all = await mockIpo.getAllIpos();
      expect(all.length).toBeGreaterThanOrEqual(6);

      const demoTech = all.find((i) => i.symbol === 'DEMOTECH');
      expect(demoTech).toBeDefined();
      expect(demoTech?.priceBand).toContain('450');
      expect(demoTech?.lotSize).toBe(31);
      expect(demoTech?.retailSubscription).toBeCloseTo(8.42, 1);
      expect(demoTech?.niiSubscription).toBeCloseTo(14.62, 1);
      expect(demoTech?.qibSubscription).toBeCloseTo(21.37, 1);
      expect(demoTech?.gmp).toBe(72);
    });
  });

  describe('Upstox API Provider Abstraction & Fallback Resiliency', () => {
    it('should fallback cleanly to mock data when Upstox credentials are blank', async () => {
      delete process.env.UPSTOX_CLIENT_ID;
      delete process.env.UPSTOX_ACCESS_TOKEN;

      const upstox = new UpstoxProvider();
      expect(upstox.isAvailable()).toBe(false);

      // Quote fallback
      const quote = await upstox.getQuote('SWIGGY');
      expect(quote).toBeDefined();
      expect(quote.symbol).toBe('SWIGGY');
      expect(quote.isMock).toBe(true);

      // OHLC fallback
      const ohlc = await upstox.getOhlc('SWIGGY', '1D');
      expect(ohlc.length).toBeGreaterThan(0);
    });
  });

  describe('GMP Service & SEBI Disclaimers', () => {
    it('should calculate GMP trends with timeframe filtering (1D, 7D, 1M, All)', () => {
      const timeframes = ['1D', '7D', '1M', 'All'] as const;

      for (const tf of timeframes) {
        const res = GmpService.getGmpHistory('DEMOTECH', 'Demo Technologies Ltd', 72, 475, tf);
        expect(res.symbol).toBe('DEMOTECH');
        expect(res.timeframe).toBe(tf);
        expect(res.history.length).toBeGreaterThan(0);
        expect(res.highestGmp).toBeGreaterThanOrEqual(res.lowestGmp);
        expect(res.disclaimer).toContain('unofficial');
        expect(res.disclaimer).toContain('Grey Market Premium');

        // Verify data points have valid timestamps
        for (const pt of res.history) {
          expect(pt.date).toBeTruthy();
          expect(typeof pt.gmp).toBe('number');
        }
      }
    });
  });

  describe('Subscription Service & Category Calculations', () => {
    it('should calculate exact multiples and visual progress statistics', () => {
      const sub = SubscriptionService.getSubscriptionDetails(
        'DEMOTECH',
        'Demo Technologies Ltd',
        13.82,
        8.42,
        14.62,
        21.37,
        1.25
      );

      expect(sub.symbol).toBe('DEMOTECH');
      expect(sub.retail).toBe(8.42);
      expect(sub.nii).toBe(14.62);
      expect(sub.qib).toBe(21.37);
      expect(sub.employee).toBe(1.25);
      expect(sub.total).toBe(13.82);
      expect(sub.totalSharesBid).toBeGreaterThan(0);
    });
  });

  describe('Market Service & Market Hours Detection', () => {
    it('should correctly report IST market hours status (OPEN / CLOSED)', () => {
      const status = MarketService.getMarketStatus();
      expect(['OPEN', 'CLOSED']).toContain(status);
    });

    it('should retrieve quotes and OHLC through unified service facade', async () => {
      const quote = await MarketService.getQuote('BAJAJHFL');
      expect(quote).toBeDefined();
      expect(quote.symbol).toBe('BAJAJHFL');
      expect(quote.ltp).toBeGreaterThan(0);

      const ohlc = await MarketService.getOhlc('BAJAJHFL', '1D');
      expect(ohlc.length).toBeGreaterThan(0);
    });
  });

  describe('IPO Service Facade & Overview Analytics', () => {
    it('should return complete Live Market Overview with 5 summary counters', async () => {
      const overview = await IpoService.getOverview();

      expect(overview.success).toBe(true);
      expect(overview.overview.upcomingCount).toBeGreaterThanOrEqual(0);
      expect(overview.overview.openCount).toBeGreaterThanOrEqual(0);
      expect(overview.overview.closingSoonCount).toBeGreaterThanOrEqual(0);
      expect(overview.overview.recentlyListedCount).toBeGreaterThanOrEqual(0);
      expect(overview.overview.totalTrackedCount).toBeGreaterThanOrEqual(
        overview.overview.upcomingCount + overview.overview.openCount + overview.overview.recentlyListedCount
      );
      expect(overview.marketStatus).toBeDefined();
      expect(overview.connectionStatus).toBe('DEMO');
      expect(overview.isMock).toBe(true);
    });

    it('should categorize IPOs into Upcoming, Open, Closed, and Listed tabs', async () => {
      const upcoming = await IpoService.getUpcomingIpos();
      const open = await IpoService.getOpenIpos();
      const closed = await IpoService.getClosedIpos();
      const listed = await IpoService.getListedIpos();

      expect(Array.isArray(upcoming)).toBe(true);
      expect(Array.isArray(open)).toBe(true);
      expect(Array.isArray(closed)).toBe(true);
      expect(Array.isArray(listed)).toBe(true);

      for (const item of open) {
        expect(item.status).toBe('Open');
        expect(item.retailSubscription).toBeDefined();
      }

      for (const item of listed) {
        expect(item.status).toBe('Listed');
        expect(item.currentPrice).toBeGreaterThan(0);
      }
    });

    it('should return subscription details for an IPO', async () => {
      const sub = await IpoService.getSubscription('DEMOTECH');
      expect(sub).toBeDefined();
      expect(sub?.retail).toBeCloseTo(8.42, 1);
    });

    it('should return GMP and GMP history with official disclaimer', async () => {
      const gmp = await IpoService.getGmp('DEMOTECH');
      expect(gmp).toBeDefined();
      expect(gmp?.gmp).toBe(72);
      expect(gmp?.disclaimer).toContain('unofficial');

      const history = await IpoService.getGmpHistory('DEMOTECH', '7D');
      expect(history).toBeDefined();
      expect(history?.history.length).toBeGreaterThan(0);
    });

    it('should provide notification-ready market alerts', () => {
      const alerts = IpoService.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      for (const alert of alerts) {
        expect(alert.id).toBeTruthy();
        expect(alert.title).toBeTruthy();
        expect(alert.message).toBeTruthy();
        expect(alert.type).toBeDefined();
      }
    });
  });

  describe('Mode Switching: USE_MOCK_MARKET_DATA=false', () => {
    it('should switch provider gracefully without error when mock mode is disabled', async () => {
      process.env.USE_MOCK_MARKET_DATA = 'false';
      expect(IpoService.isMockMode()).toBe(false);

      const overview = await IpoService.getOverview();
      expect(overview.success).toBe(true);
      expect(overview.connectionStatus).toBe('LIVE');
      expect(overview.isMock).toBe(false);
    });
  });
});
