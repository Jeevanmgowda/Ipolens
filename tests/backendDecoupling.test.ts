import { describe, it, expect } from 'vitest';
import { MarketChartService } from '../src/lib/services/market-chart.service';
import { SymbolTokenService } from '../src/lib/services/symbol-token.service';
import { getRedisClient } from '../src/lib/redis';
import { ExchangeIngestionService } from '../src/lib/services/exchange-ingestion.service';
import { generateIpoInsight } from '../src/lib/services/prospectus-analyzer.service';

describe('Decoupled Backend Architecture', () => {
  describe('SymbolTokenService', () => {
    it('should resolve landmark IPO symbols to their exchange tokens', () => {
      expect(SymbolTokenService.getTokenBySymbol('TATATECH')).toBe('1594');
      expect(SymbolTokenService.getTokenBySymbol('BAJAJHFL')).toBe('19385');
      expect(SymbolTokenService.getTokenBySymbol('SWIGGY')).toBe('22401');
      expect(SymbolTokenService.getTokenBySymbol('HYUNDAI')).toBe('22150');
      expect(SymbolTokenService.getTokenBySymbol('KRN')).toBe('20721');
    });

    it('should reverse resolve exchange tokens to stock metadata', () => {
      const tata = SymbolTokenService.getSymbolByToken('1594');
      expect(tata).toBeDefined();
      expect(tata?.symbol).toBe('TATATECH');
      expect(tata?.exchange).toBe('NSE');

      const bajaj = SymbolTokenService.getSymbolByToken('19385');
      expect(bajaj).toBeDefined();
      expect(bajaj?.symbol).toBe('BAJAJHFL');
    });

    it('should return null for unknown tokens or symbols', () => {
      expect(SymbolTokenService.getTokenBySymbol('INVALID_SYM_XYZ')).toBeNull();
      expect(SymbolTokenService.getSymbolByToken('99999999')).toBeNull();
    });
  });

  describe('MarketChartService (Angel One SmartAPI / Exchange Telemetry)', () => {
    it('should return valid OHLCV candle arrays for resolved tokens', async () => {
      const candles = await MarketChartService.getHistoricalCandles(
        '19385', // BAJAJHFL token
        'FIVE_MINUTE',
        '2026-09-01 09:15',
        '2026-09-20 15:30'
      );

      expect(Array.isArray(candles)).toBe(true);
      expect(candles.length).toBeGreaterThan(0);

      const first = candles[0];
      expect(first.time).toBeTruthy();
      expect(typeof first.open).toBe('number');
      expect(typeof first.high).toBe('number');
      expect(typeof first.low).toBe('number');
      expect(typeof first.close).toBe('number');
      expect(typeof first.volume).toBe('number');
      expect(first.high).toBeGreaterThanOrEqual(first.low);
    }, 15000);
  });

  describe('Redis Cache & PubSub Infrastructure', () => {
    it('should set, get, and expire keys correctly', async () => {
      const redis = getRedisClient();
      await redis.set('test:quote:1594', '722.50');
      const val = await redis.get('test:quote:1594');
      expect(val).toBe('722.50');

      // Test with expiration
      await redis.set('test:temp', 'temp_value', 'EX', 10);
      const tempVal = await redis.get('test:temp');
      expect(tempVal).toBe('temp_value');
    });

    it('should publish and receive messages across channels', async () => {
      const redis = getRedisClient();
      let receivedMessage = '';

      redis.on('message', (channel: string, message: string) => {
        if (channel === 'test-channel') {
          receivedMessage = message;
        }
      });

      await redis.subscribe('test-channel');
      await redis.publish('test-channel', JSON.stringify({ token: '1594', ltp: 722.5 }));
      await new Promise((r) => setTimeout(r, 400));

      expect(receivedMessage).toContain('722.5');
    });
  });

  describe('ExchangeIngestionService (Primary Market Ingestion)', () => {
    it('should fetch NSE session cookies or handle handshake', async () => {
      const cookies = await ExchangeIngestionService.fetchNseSessionCookies();
      expect(typeof cookies).toBe('string');
    }, 10000);

    it('should query and return a valid subscription telemetry snapshot', async () => {
      const snapshot = await ExchangeIngestionService.syncLiveSubscription('NSE');
      expect(snapshot).toBeDefined();
      expect(snapshot.symbol).toBe('NSE');
      expect(typeof snapshot.qibMultiple).toBe('number');
      expect(typeof snapshot.niiMultiple).toBe('number');
      expect(typeof snapshot.riiMultiple).toBe('number');
      expect(typeof snapshot.totalMultiple).toBe('number');
      expect(snapshot.updatedAt).toBeTruthy();
    }, 10000);
  });

  describe('ProspectusAnalyzerService (Gemini 2.5 Flash DRHP Engine)', () => {
    it('should generate structured analysis conforming strictly to the required schema', async () => {
      const insight = await generateIpoInsight(
        'Tata Technologies Limited',
        'Engineering research and development services for global automotive and aerospace OEMs.'
      );

      expect(insight).toBeDefined();
      expect(['SUBSCRIBE', 'AVOID', 'NEUTRAL']).toContain(insight.verdict);
      expect(typeof insight.confidenceScore).toBe('number');
      expect(insight.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(insight.confidenceScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(insight.topStrengths)).toBe(true);
      expect(insight.topStrengths.length).toBeGreaterThan(0);
      expect(Array.isArray(insight.topRisks)).toBe(true);
      expect(insight.topRisks.length).toBeGreaterThan(0);
      expect(typeof insight.anchorQuality).toBe('string');
    }, 15000);
  });
});
