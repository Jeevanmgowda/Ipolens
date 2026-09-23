import { describe, it, expect } from 'vitest';
import {
  AllocationOptimizerService,
  OptimizationInput,
} from '../src/lib/services/allocation-optimizer.service';
import { FamilyPanProfile } from '../src/types/pan';

describe('Smart Multi-PAN Allocation Engine (Probability Maximizer)', () => {
  const mockPans: FamilyPanProfile[] = [
    {
      id: 'pan-1',
      name: 'Jeevan Gowda',
      relationship: 'Self',
      pan: 'ABCDE1234F',
      broker: 'Zerodha',
      createdAt: '2026-09-20',
    },
    {
      id: 'pan-2',
      name: 'Rekha Gowda',
      relationship: 'Spouse',
      pan: 'BCDEF2345G',
      broker: 'Groww',
      createdAt: '2026-09-20',
    },
    {
      id: 'pan-3',
      name: 'M. Gowda',
      relationship: 'Parent',
      pan: 'CDEFG3456H',
      broker: 'AngelOne',
      createdAt: '2026-09-20',
    },
    {
      id: 'pan-4',
      name: 'Sunita Gowda',
      relationship: 'Parent',
      pan: 'DEFGH4567I',
      broker: 'Upstox',
      createdAt: '2026-09-20',
    },
  ];

  describe('SEBI Category Threshold Calculations', () => {
    it('should calculate correct minimum sNII and bNII lot sizes', () => {
      // Stock with price 1785 and lot size 14 (Lot cost: 1785 * 14 = ₹24,990)
      const reqs = AllocationOptimizerService.getCategoryRequirements(1785, 14);

      expect(reqs.singleLotCost).toBe(24990);
      expect(reqs.retail.lots).toBe(1);
      expect(reqs.retail.cost).toBe(24990);

      // sNII must strictly exceed ₹2,00,000
      expect(reqs.snii.cost).toBeGreaterThan(200000);
      expect(reqs.snii.cost - reqs.singleLotCost).toBeLessThanOrEqual(200000);
      expect(reqs.snii.lots).toBe(9); // 9 * 24990 = 224910 > 200000
      expect(reqs.snii.cost).toBe(224910);

      // bNII must strictly exceed ₹10,00,000
      expect(reqs.bnii.cost).toBeGreaterThan(1000000);
      expect(reqs.bnii.cost - reqs.singleLotCost).toBeLessThanOrEqual(1000000);
      expect(reqs.bnii.lots).toBe(41); // 41 * 24990 = 1024590 > 1000000
    });
  });

  describe('Empty and Edge Conditions', () => {
    it('should gracefully handle empty PAN profiles list', () => {
      const result = AllocationOptimizerService.optimize({
        symbol: 'NSE',
        companyName: 'National Stock Exchange of India Ltd',
        price: 1785,
        lotSize: 14,
        totalBudget: 200000,
        pans: [],
      });

      expect(result.totalPansCount).toBe(0);
      expect(result.allocatedPansCount).toBe(0);
      expect(result.smartStrategy.allotmentProbability).toBe(0);
      expect(result.recommendationRationale.length).toBeGreaterThan(0);
    });
  });

  describe('Mathematical Probability Scaling across Multi-PANs', () => {
    it('should calculate independent binomial probability for Retail across 4 PANs', () => {
      // 10x Retail subscription -> 1/10 = 0.10 probability per PAN
      const telemetry = {
        symbol: 'NSE',
        qibMultiple: 20.0,
        niiMultiple: 10.0,
        sNiiMultiple: 12.0,
        bNiiMultiple: 15.0,
        riiMultiple: 10.0,
        totalMultiple: 14.0,
        updatedAt: '2026-09-21',
      };

      const result = AllocationOptimizerService.optimize({
        symbol: 'NSE',
        companyName: 'National Stock Exchange of India Ltd',
        price: 1785,
        lotSize: 14,
        totalBudget: 150000,
        strategy: 'capital_efficient',
        pans: mockPans,
        subscription: telemetry,
      });

      expect(result.allocatedPansCount).toBe(4);
      // All 4 PANs should be allocated 1 lot Retail
      result.allocations.forEach((alloc) => {
        expect(alloc.category).toBe('Retail');
        expect(alloc.lots).toBe(1);
        expect(alloc.lotteryProbability).toBeCloseTo(0.1, 2);
      });

      // Combined probability = 1 - (1 - 0.1)^4 = 1 - 0.6561 = 0.3439 (34.39%)
      expect(result.smartStrategy.allotmentProbability).toBeCloseTo(0.3439, 3);
      // Naive probability for 1 PAN is only 10%
      expect(result.naiveStrategy.allotmentProbability).toBeCloseTo(0.1, 2);
      // Uplift should be ~244%
      expect(result.smartStrategy.probabilityUpliftPercent).toBeGreaterThanOrEqual(240);
    });

    it('should exploit sNII advantage when sNII subscription is substantially lower than Retail', () => {
      // Retail is 25x (4% odds), but sNII is only 3x (33.3% odds)
      const telemetry = {
        symbol: 'SPECTRAA',
        qibMultiple: 15.0,
        niiMultiple: 3.5,
        sNiiMultiple: 3.0,
        bNiiMultiple: 5.0,
        riiMultiple: 25.0,
        totalMultiple: 12.0,
        updatedAt: '2026-09-21',
      };

      const result = AllocationOptimizerService.optimize({
        symbol: 'SPECTRAA',
        companyName: 'SpectraA Technology Solutions',
        price: 250,
        lotSize: 60,
        gmp: 80,
        totalBudget: 350000,
        strategy: 'max_probability',
        pans: mockPans,
        subscription: telemetry,
      });

      // PAN 1 (Self) should receive sNII because 33.3% > 4%
      const selfAlloc = result.allocations.find((a) => a.relationship === 'Self');
      expect(selfAlloc?.category).toBe('sNII');
      expect(selfAlloc?.lotteryProbability).toBeCloseTo(0.333, 2);

      // Remaining PANs should receive Retail
      const spouseAlloc = result.allocations.find((a) => a.relationship === 'Spouse');
      expect(spouseAlloc?.category).toBe('Retail');
      expect(spouseAlloc?.lots).toBe(1);

      // Combined probability should be substantially higher than naive 4%
      expect(result.smartStrategy.allotmentProbability).toBeGreaterThan(0.35);
      expect(result.smartStrategy.probabilityUpliftPercent).toBeGreaterThan(500);
    });

    it('should respect capital constraints and skip PANs when budget is exhausted', () => {
      // Budget only enough for 2 retail lots (Lot cost = ₹24,990 * 2 = ₹49,980)
      const result = AllocationOptimizerService.optimize({
        symbol: 'NSE',
        companyName: 'National Stock Exchange of India Ltd',
        price: 1785,
        lotSize: 14,
        totalBudget: 55000, // Enough for 2 lots (49,980), but not 3 (74,970)
        strategy: 'capital_efficient',
        pans: mockPans,
      });

      expect(result.allocatedPansCount).toBe(2);
      const active = result.allocations.filter((a) => a.category === 'Retail');
      const skipped = result.allocations.filter((a) => a.category === 'Skip');

      expect(active.length).toBe(2);
      expect(skipped.length).toBe(2);
      expect(result.totalCapitalBlocked).toBe(49980);
      expect(result.unutilizedCapital).toBe(5020);
    });

    it('should maximize expected profit with sNII multi-lot bonus when requested', () => {
      const telemetry = {
        symbol: 'AXIOMGAS',
        qibMultiple: 30.0,
        niiMultiple: 8.0,
        sNiiMultiple: 4.0,
        bNiiMultiple: 12.0,
        riiMultiple: 18.0,
        totalMultiple: 16.0,
        updatedAt: '2026-09-21',
      };

      const result = AllocationOptimizerService.optimize({
        symbol: 'AXIOMGAS',
        companyName: 'Axiom Gas Engineering Limited',
        price: 500,
        lotSize: 30,
        gmp: 150,
        totalBudget: 300000,
        strategy: 'max_expected_profit',
        pans: mockPans,
        subscription: telemetry,
      });

      expect(result.strategy).toBe('max_expected_profit');
      expect(result.smartStrategy.expectedGains).toBeGreaterThan(0);
      expect(result.smartStrategy.expectedLots).toBeGreaterThan(0);
    });
  });
});
