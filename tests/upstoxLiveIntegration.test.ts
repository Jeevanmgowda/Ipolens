import { describe, it, expect } from 'vitest';
import {
  UpstoxReconciliationService,
  ReconciledIpoRecord,
} from '../src/lib/services/upstox-reconciliation.service';
import {
  UPSTOX_FIXTURE_OPEN_MAINBOARD,
  UPSTOX_FIXTURE_OPEN_SME,
  UPSTOX_FIXTURE_UPCOMING,
} from './fixtures/upstoxIpoFixtures';

describe('Live IPO Data Integration & Dual-Source Reconciliation', () => {
  describe('Upstox API v2 Fixture Normalization', () => {
    it('should correctly normalize Mainboard IPO detail fixture (Swiggy)', () => {
      const unified = UpstoxReconciliationService.normalizeUpstoxPayload(
        UPSTOX_FIXTURE_OPEN_MAINBOARD.data
      );

      expect(unified.symbol).toBe('SWIGGY');
      expect(unified.companyName).toBe('Swiggy Limited');
      expect(unified.issueType).toBe('regular');
      expect(unified.status).toBe('open');
      expect(unified.priceBandMin).toBe(371);
      expect(unified.priceBandMax).toBe(390);
      expect(unified.lotSize).toBe(38);
      expect(unified.subscriptionTotal).toBe(3.59);
      expect(unified.subscriptionRetail).toBe(1.14);
      expect(unified.subscriptionHni).toBe(0.41);
      expect(unified.subscriptionQib).toBe(6.02);
      expect(unified.registrar).toContain('Link Intime');
    });

    it('should correctly normalize SME IPO detail fixture (Premier)', () => {
      const unified = UpstoxReconciliationService.normalizeUpstoxPayload(
        UPSTOX_FIXTURE_OPEN_SME.data
      );

      expect(unified.symbol).toBe('PREMIER');
      expect(unified.issueType).toBe('sme');
      expect(unified.lotSize).toBe(1200);
      expect(unified.priceBandMin).toBe(110);
      expect(unified.priceBandMax).toBe(115);
      expect(unified.subscriptionTotal).toBe(42.15);
      expect(unified.subscriptionRetail).toBe(38.4);
      expect(unified.subscriptionHni).toBe(45.9);
      expect(unified.registrar).toContain('Bigshare');
    });

    it('should correctly normalize Upcoming IPO detail fixture (NSE)', () => {
      const unified = UpstoxReconciliationService.normalizeUpstoxPayload(
        UPSTOX_FIXTURE_UPCOMING.data
      );

      expect(unified.symbol).toBe('NSE');
      expect(unified.status).toBe('upcoming');
      expect(unified.priceBandMax).toBe(1785);
      expect(unified.lotSize).toBe(14);
      expect(unified.subscriptionTotal).toBe(0);
      expect(unified.registrar).toContain('KFin');
    });
  });

  describe('Dual-Source Reconciliation & Cross-Validation', () => {
    const baseSwiggy = UpstoxReconciliationService.normalizeUpstoxPayload(
      UPSTOX_FIXTURE_OPEN_MAINBOARD.data
    );

    it('should verify consensus when Upstox matches secondary NSE exchange feed', () => {
      const secondaryNse = {
        priceBandMin: 371,
        priceBandMax: 390,
        lotSize: 38,
        subscriptionTotal: 3.59,
        sourceName: 'NSE Public Bid Details Page',
      };

      const result = UpstoxReconciliationService.reconcile(
        baseSwiggy,
        secondaryNse,
        new Date()
      );

      expect(result.reconciliationStatus).toBe('CONSENSUS_VERIFIED');
      expect(result.confidenceScore).toBe(98);
      expect(result.discrepancies.length).toBe(0);
      expect(result.primarySource).toBe('UPSTOX_V2');
      expect(result.secondarySource).toBe('NSE Public Bid Details Page');
      expect(result.isStale).toBe(false);
    });

    it('should flag mismatch when secondary source has divergent price band or lot size', () => {
      const secondaryConflicting = {
        priceBandMin: 371,
        priceBandMax: 410, // Divergent price!
        lotSize: 35,       // Divergent lot size!
        subscriptionTotal: 3.59,
      };

      const result = UpstoxReconciliationService.reconcile(
        baseSwiggy,
        secondaryConflicting,
        new Date()
      );

      expect(result.reconciliationStatus).toBe('MISMATCH_FLAGGED');
      expect(result.confidenceScore).toBeLessThan(90);
      expect(result.discrepancies.length).toBe(2);

      const fields = result.discrepancies.map((d) => d.field);
      expect(fields).toContain('priceBandMax');
      expect(fields).toContain('lotSize');
    });

    it('should flag warning when subscription exceeds 5% tolerance limit', () => {
      const secondarySlightDiff = {
        priceBandMax: 390,
        lotSize: 38,
        subscriptionTotal: 4.25, // Divergent subscription (> 5% difference from 3.59)
      };

      const result = UpstoxReconciliationService.reconcile(
        baseSwiggy,
        secondarySlightDiff,
        new Date()
      );

      expect(result.reconciliationStatus).toBe('MISMATCH_FLAGGED');
      expect(result.discrepancies.some((d) => d.field === 'subscriptionTotal')).toBe(true);
    });

    it('should identify stale data older than 15 minutes', () => {
      const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
      const result = UpstoxReconciliationService.reconcile(baseSwiggy, undefined, twentyMinsAgo);

      expect(result.isStale).toBe(true);
      expect(result.reconciliationStatus).toBe('LOCAL_STALE');
      expect(result.freshnessLabel).toBe('20m ago');
      expect(result.confidenceScore).toBeLessThanOrEqual(65);
    });
  });

  describe('Event Detection & Milestone Triggers', () => {
    it('should detect when total subscription crosses milestone thresholds', () => {
      const prev = { subscriptionTotal: 8.4 };
      const curr = {
        symbol: 'SWIGGY',
        companyName: 'Swiggy Limited',
        subscriptionTotal: 12.8,
      };

      const alerts = UpstoxReconciliationService.detectEvents(prev, curr);
      expect(alerts.length).toBe(1);
      expect(alerts[0].eventType).toBe('SUBSCRIPTION_MILESTONE');
      expect(alerts[0].thresholdCrossed).toBe('10x');
      expect(alerts[0].message).toContain('crossed 10x');
    });

    it('should detect sudden Grey Market Premium surge (>= 15%)', () => {
      const prev = { gmp: 40 };
      const curr = {
        symbol: 'TATATECH',
        companyName: 'Tata Technologies',
        gmp: 55, // +37.5% surge!
      };

      const alerts = UpstoxReconciliationService.detectEvents(prev, curr);
      const gmpAlert = alerts.find((a) => a.eventType === 'GMP_SURGE');
      expect(gmpAlert).toBeDefined();
      expect(gmpAlert?.thresholdCrossed).toContain('+37.5%');
    });
  });

  describe('Upstox Token Health & Connection Status', () => {
    it('should report missing when token is empty', () => {
      const status = UpstoxReconciliationService.checkTokenHealth('');
      expect(status.isConfigured).toBe(false);
      expect(status.tokenStatus).toBe('MISSING');
    });

    it('should report placeholder when default template strings are used', () => {
      const status = UpstoxReconciliationService.checkTokenHealth('your_upstox_token_here');
      expect(status.isConfigured).toBe(false);
      expect(status.tokenStatus).toBe('PLACEHOLDER');
    });

    it('should report valid when a production-length bearer token is provided', () => {
      const validMockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1cHN0b3hfcHJvIn0.valid_signature_token_string';
      const status = UpstoxReconciliationService.checkTokenHealth(validMockToken);
      expect(status.isConfigured).toBe(true);
      expect(status.tokenStatus).toBe('VALID');
    });
  });
});
