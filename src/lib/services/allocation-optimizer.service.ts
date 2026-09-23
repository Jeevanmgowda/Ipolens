import { FamilyPanProfile } from '@/types/pan';
import { SubscriptionSnapshot, ExchangeIngestionService } from './exchange-ingestion.service';

export type OptimizationStrategy = 'max_probability' | 'max_expected_profit' | 'capital_efficient';

export interface PanAllocationRecommendation {
  panId: string;
  holderName: string;
  relationship: string;
  panMasked: string;
  broker: string;
  category: 'Retail' | 'sNII' | 'bNII' | 'Skip';
  lots: number;
  shares: number;
  blockedCapital: number;
  lotteryProbability: number; // 0.00 to 1.00
  oddsRatioText: string;
  reason: string;
}

export interface OptimizationResult {
  symbol: string;
  companyName: string;
  price: number;
  lotSize: number;
  gmp: number;
  strategy: OptimizationStrategy;
  totalBudgetProvided: number;
  totalCapitalBlocked: number;
  unutilizedCapital: number;
  totalPansCount: number;
  allocatedPansCount: number;
  allocations: PanAllocationRecommendation[];

  naiveStrategy: {
    name: string;
    description: string;
    capitalBlocked: number;
    allotmentProbability: number;
    expectedLots: number;
    expectedGains: number;
  };
  smartStrategy: {
    name: string;
    description: string;
    capitalBlocked: number;
    allotmentProbability: number;
    expectedLots: number;
    expectedGains: number;
    probabilityUpliftPercent: number;
  };

  telemetrySnapshot: {
    retailMultiple: number;
    sNiiMultiple: number;
    bNiiMultiple: number;
    qibMultiple: number;
    totalMultiple: number;
    updatedAt: string;
    source?: string;
  };

  recommendationRationale: string[];
}

export interface OptimizationInput {
  symbol: string;
  companyName: string;
  price: number;
  lotSize: number;
  gmp?: number;
  totalBudget?: number;
  strategy?: OptimizationStrategy;
  pans: FamilyPanProfile[];
  subscription?: SubscriptionSnapshot;
}

export class AllocationOptimizerService {
  /**
   * Calculates minimum required lots and capital for each category under SEBI regulations
   */
  static getCategoryRequirements(price: number, lotSize: number) {
    const singleLotCost = price * lotSize;

    // Retail: 1 lot up to max ₹2,00,000
    const retailLots = 1;
    const retailCost = singleLotCost;

    // Small NII: strictly > ₹2,00,000 and <= ₹10,00,000
    const minSniiLots = Math.floor(200000 / singleLotCost) + 1;
    const sniiCost = minSniiLots * singleLotCost;

    // Big NII: strictly > ₹10,00,000
    const minBniiLots = Math.floor(1000000 / singleLotCost) + 1;
    const bniiCost = minBniiLots * singleLotCost;

    return {
      singleLotCost,
      retail: {
        lots: retailLots,
        cost: retailCost,
      },
      snii: {
        lots: minSniiLots,
        cost: sniiCost,
      },
      bnii: {
        lots: minBniiLots,
        cost: bniiCost,
      },
    };
  }

  /**
   * Core allocation optimizer combining SEBI allotment rules with live subscription telemetry
   */
  static optimize(input: OptimizationInput): OptimizationResult {
    const {
      symbol,
      companyName,
      price,
      lotSize,
      gmp = 0,
      totalBudget = 500000,
      strategy = 'max_probability',
      pans,
      subscription,
    } = input;

    // Fallback subscription if not provided
    const telemetry = subscription || {
      symbol,
      qibMultiple: 12.5,
      niiMultiple: 6.0,
      sNiiMultiple: 4.2,
      bNiiMultiple: 7.8,
      riiMultiple: 11.4,
      totalMultiple: 9.8,
      updatedAt: new Date().toISOString(),
      source: 'Default Telemetry Model',
    };

    const reqs = this.getCategoryRequirements(price, lotSize);

    // Compute category baseline lottery probabilities
    const retailOdds = ExchangeIngestionService.calculateOdds(telemetry.riiMultiple);
    const sniiOdds = ExchangeIngestionService.calculateOdds(telemetry.sNiiMultiple);
    const bniiOdds = ExchangeIngestionService.calculateOdds(telemetry.bNiiMultiple);

    let remainingBudget = totalBudget;
    const allocations: PanAllocationRecommendation[] = [];
    const rationale: string[] = [];

    // Prioritize primary PAN (Self) for higher category if appropriate
    const sortedPans = [...pans].sort((a, b) => {
      if (a.relationship === 'Self') return -1;
      if (b.relationship === 'Self') return 1;
      return 0;
    });

    if (sortedPans.length === 0) {
      // Empty PAN list handling
      return this.generateEmptyResult(input, telemetry);
    }

    if (strategy === 'capital_efficient') {
      // Capital efficient strategy: 1 Lot Retail across all available PANs
      rationale.push(
        `Capital Efficient Strategy: Under SEBI retail lottery rules, bidding >1 lot in a single PAN provides 0 extra probability. Spreading 1 lot across all ${sortedPans.length} family PANs achieves maximum lottery exposure with minimal capital.`
      );

      for (const p of sortedPans) {
        if (remainingBudget >= reqs.retail.cost) {
          allocations.push({
            panId: p.id,
            holderName: p.name,
            relationship: p.relationship,
            panMasked: p.pan,
            broker: p.broker,
            category: 'Retail',
            lots: 1,
            shares: lotSize,
            blockedCapital: reqs.retail.cost,
            lotteryProbability: retailOdds.probability,
            oddsRatioText: retailOdds.oddsText,
            reason: `Retail Lottery Candidate (${retailOdds.oddsText})`,
          });
          remainingBudget -= reqs.retail.cost;
        } else {
          allocations.push({
            panId: p.id,
            holderName: p.name,
            relationship: p.relationship,
            panMasked: p.pan,
            broker: p.broker,
            category: 'Skip',
            lots: 0,
            shares: 0,
            blockedCapital: 0,
            lotteryProbability: 0,
            oddsRatioText: 'N/A',
            reason: 'Insufficient remaining budget for Retail lot',
          });
        }
      }
    } else if (strategy === 'max_expected_profit') {
      // Maximize Expected Profit: Prioritize sNII (or bNII) where winning yields multiple lots
      rationale.push(
        `Profit Maximization: sNII lottery winners receive minimum ${reqs.snii.lots} lots (₹${reqs.snii.cost.toLocaleString('en-IN')}). With ${telemetry.sNiiMultiple}x subscription, expected listing gain per sNII bid is ₹${Math.round(sniiOdds.probability * reqs.snii.lots * lotSize * gmp).toLocaleString('en-IN')}.`
      );

      let sniiAssigned = false;
      let bniiAssigned = false;

      // Can we afford Big NII?
      if (remainingBudget >= reqs.bnii.cost && sortedPans.length >= 1 && totalBudget >= 1200000) {
        const p = sortedPans[0];
        allocations.push({
          panId: p.id,
          holderName: p.name,
          relationship: p.relationship,
          panMasked: p.pan,
          broker: p.broker,
          category: 'bNII',
          lots: reqs.bnii.lots,
          shares: reqs.bnii.lots * lotSize,
          blockedCapital: reqs.bnii.cost,
          lotteryProbability: bniiOdds.probability,
          oddsRatioText: bniiOdds.oddsText,
          reason: `High Networth bNII Bid (${reqs.bnii.lots} lots). Odds: ${bniiOdds.oddsText}`,
        });
        remainingBudget -= reqs.bnii.cost;
        bniiAssigned = true;
      }

      // Can remaining PANs take sNII?
      for (let i = bniiAssigned ? 1 : 0; i < sortedPans.length; i++) {
        const p = sortedPans[i];
        if (remainingBudget >= reqs.snii.cost && !sniiAssigned) {
          allocations.push({
            panId: p.id,
            holderName: p.name,
            relationship: p.relationship,
            panMasked: p.pan,
            broker: p.broker,
            category: 'sNII',
            lots: reqs.snii.lots,
            shares: reqs.snii.lots * lotSize,
            blockedCapital: reqs.snii.cost,
            lotteryProbability: sniiOdds.probability,
            oddsRatioText: sniiOdds.oddsText,
            reason: `Small NII Application (${reqs.snii.lots} lots). Odds: ${sniiOdds.oddsText}`,
          });
          remainingBudget -= reqs.snii.cost;
          sniiAssigned = true;
        } else if (remainingBudget >= reqs.retail.cost) {
          allocations.push({
            panId: p.id,
            holderName: p.name,
            relationship: p.relationship,
            panMasked: p.pan,
            broker: p.broker,
            category: 'Retail',
            lots: 1,
            shares: lotSize,
            blockedCapital: reqs.retail.cost,
            lotteryProbability: retailOdds.probability,
            oddsRatioText: retailOdds.oddsText,
            reason: `Retail Lot Diversification (${retailOdds.oddsText})`,
          });
          remainingBudget -= reqs.retail.cost;
        } else {
          allocations.push({
            panId: p.id,
            holderName: p.name,
            relationship: p.relationship,
            panMasked: p.pan,
            broker: p.broker,
            category: 'Skip',
            lots: 0,
            shares: 0,
            blockedCapital: 0,
            lotteryProbability: 0,
            oddsRatioText: 'N/A',
            reason: 'Budget limit reached',
          });
        }
      }
    } else {
      // Default: 'max_probability' (Maximize probability of getting at least 1 allotment)
      // Check if sNII probability exceeds Retail probability or if budget permits combination
      const isSniiFavorable =
        sniiOdds.probability > retailOdds.probability &&
        remainingBudget >= reqs.snii.cost;

      if (isSniiFavorable && sortedPans.length > 0) {
        // Allocate 1 sNII on primary PAN
        const p = sortedPans[0];
        allocations.push({
          panId: p.id,
          holderName: p.name,
          relationship: p.relationship,
          panMasked: p.pan,
          broker: p.broker,
          category: 'sNII',
          lots: reqs.snii.lots,
          shares: reqs.snii.lots * lotSize,
          blockedCapital: reqs.snii.cost,
          lotteryProbability: sniiOdds.probability,
          oddsRatioText: sniiOdds.oddsText,
          reason: `sNII subscription (${telemetry.sNiiMultiple}x) offers superior lottery probability vs Retail (${telemetry.riiMultiple}x)`,
        });
        remainingBudget -= reqs.snii.cost;

        rationale.push(
          `sNII Advantage: sNII is subscribed ${telemetry.sNiiMultiple}x (${(sniiOdds.probability * 100).toFixed(1)}% odds) compared to Retail at ${telemetry.riiMultiple}x (${(retailOdds.probability * 100).toFixed(1)}% odds). Allocating 1 sNII bid yields higher marginal probability.`
        );

        // Remaining PANs get 1 lot Retail
        for (let i = 1; i < sortedPans.length; i++) {
          const remPan = sortedPans[i];
          if (remainingBudget >= reqs.retail.cost) {
            allocations.push({
              panId: remPan.id,
              holderName: remPan.name,
              relationship: remPan.relationship,
              panMasked: remPan.pan,
              broker: remPan.broker,
              category: 'Retail',
              lots: 1,
              shares: lotSize,
              blockedCapital: reqs.retail.cost,
              lotteryProbability: retailOdds.probability,
              oddsRatioText: retailOdds.oddsText,
              reason: `Retail Lottery Bid (${retailOdds.oddsText})`,
            });
            remainingBudget -= reqs.retail.cost;
          } else {
            allocations.push({
              panId: remPan.id,
              holderName: remPan.name,
              relationship: remPan.relationship,
              panMasked: remPan.pan,
              broker: remPan.broker,
              category: 'Skip',
              lots: 0,
              shares: 0,
              blockedCapital: 0,
              lotteryProbability: 0,
              oddsRatioText: 'N/A',
              reason: 'Budget fully utilized',
            });
          }
        }
      } else {
        // Distribute 1 Lot Retail across all available family PANs
        rationale.push(
          `Retail Multi-PAN Distribution: Retail subscription multiple (${telemetry.riiMultiple}x) is favorable or capital constraint favors distributing 1 lot across all family members.`
        );

        for (const p of sortedPans) {
          if (remainingBudget >= reqs.retail.cost) {
            allocations.push({
              panId: p.id,
              holderName: p.name,
              relationship: p.relationship,
              panMasked: p.pan,
              broker: p.broker,
              category: 'Retail',
              lots: 1,
              shares: lotSize,
              blockedCapital: reqs.retail.cost,
              lotteryProbability: retailOdds.probability,
              oddsRatioText: retailOdds.oddsText,
              reason: `Retail Lottery Candidate (${retailOdds.oddsText})`,
            });
            remainingBudget -= reqs.retail.cost;
          } else {
            allocations.push({
              panId: p.id,
              holderName: p.name,
              relationship: p.relationship,
              panMasked: p.pan,
              broker: p.broker,
              category: 'Skip',
              lots: 0,
              shares: 0,
              blockedCapital: 0,
              lotteryProbability: 0,
              oddsRatioText: 'N/A',
              reason: 'Budget fully utilized',
            });
          }
        }
      }
    }

    // Mathematical calculations
    const activeAllocations = allocations.filter((a) => a.category !== 'Skip');
    const totalBlocked = activeAllocations.reduce((sum, a) => sum + a.blockedCapital, 0);

    // Combined Probability: P(>= 1 allotment) = 1 - product(1 - P_i)
    let nonAllotmentProb = 1.0;
    let expectedLotsSum = 0;

    for (const alloc of activeAllocations) {
      nonAllotmentProb *= 1.0 - alloc.lotteryProbability;
      expectedLotsSum += alloc.lotteryProbability * alloc.lots;
    }

    const smartAllotmentProbability = activeAllocations.length > 0 ? 1.0 - nonAllotmentProb : 0;
    const smartExpectedGains = Math.round(expectedLotsSum * lotSize * gmp);

    // Naive Strategy Comparison: Investor applying with 1 single PAN in Retail category (standard behavior)
    // Under SEBI lottery rules, applying >1 lot in Retail provides ZERO extra odds over 1 lot.
    const naiveProbability = retailOdds.probability;
    const naiveExpectedLots = retailOdds.probability * 1;
    const naiveExpectedGains = Math.round(naiveExpectedLots * lotSize * gmp);

    const upliftPercent =
      naiveProbability > 0
        ? Math.round(((smartAllotmentProbability - naiveProbability) / naiveProbability) * 100)
        : 0;

    rationale.push(
      `Mathematical Probability Uplift: Spreading bids across ${activeAllocations.length} independent PANs elevates combined allotment odds from ${(naiveProbability * 100).toFixed(1)}% (single retail PAN) to ${(smartAllotmentProbability * 100).toFixed(1)}% (+${upliftPercent}% boost).`
    );

    return {
      symbol,
      companyName,
      price,
      lotSize,
      gmp,
      strategy,
      totalBudgetProvided: totalBudget,
      totalCapitalBlocked: totalBlocked,
      unutilizedCapital: Math.max(0, totalBudget - totalBlocked),
      totalPansCount: pans.length,
      allocatedPansCount: activeAllocations.length,
      allocations,
      naiveStrategy: {
        name: 'Single-PAN Application',
        description: `Applying with 1 single PAN in Retail category (${(naiveProbability * 100).toFixed(1)}% lottery chance)`,
        capitalBlocked: reqs.retail.cost,
        allotmentProbability: naiveProbability,
        expectedLots: Number(naiveExpectedLots.toFixed(2)),
        expectedGains: naiveExpectedGains,
      },
      smartStrategy: {
        name: 'Smart Multi-PAN Diversified Allocation',
        description: `Optimized across ${activeAllocations.length} family PANs`,
        capitalBlocked: totalBlocked,
        allotmentProbability: smartAllotmentProbability,
        expectedLots: Number(expectedLotsSum.toFixed(2)),
        expectedGains: smartExpectedGains,
        probabilityUpliftPercent: upliftPercent,
      },
      telemetrySnapshot: {
        retailMultiple: telemetry.riiMultiple,
        sNiiMultiple: telemetry.sNiiMultiple,
        bNiiMultiple: telemetry.bNiiMultiple,
        qibMultiple: telemetry.qibMultiple,
        totalMultiple: telemetry.totalMultiple,
        updatedAt: telemetry.updatedAt,
        source: telemetry.source,
      },
      recommendationRationale: rationale,
    };
  }

  private static generateEmptyResult(
    input: OptimizationInput,
    telemetry: SubscriptionSnapshot
  ): OptimizationResult {
    return {
      symbol: input.symbol,
      companyName: input.companyName,
      price: input.price,
      lotSize: input.lotSize,
      gmp: input.gmp || 0,
      strategy: input.strategy || 'max_probability',
      totalBudgetProvided: input.totalBudget || 0,
      totalCapitalBlocked: 0,
      unutilizedCapital: input.totalBudget || 0,
      totalPansCount: 0,
      allocatedPansCount: 0,
      allocations: [],
      naiveStrategy: {
        name: 'Single-PAN Application',
        description: 'No PAN profiles registered',
        capitalBlocked: 0,
        allotmentProbability: 0,
        expectedLots: 0,
        expectedGains: 0,
      },
      smartStrategy: {
        name: 'Smart Multi-PAN Diversified Allocation',
        description: 'Please add family PAN profiles in the Family PAN Manager to optimize',
        capitalBlocked: 0,
        allotmentProbability: 0,
        expectedLots: 0,
        expectedGains: 0,
        probabilityUpliftPercent: 0,
      },
      telemetrySnapshot: {
        retailMultiple: telemetry.riiMultiple,
        sNiiMultiple: telemetry.sNiiMultiple,
        bNiiMultiple: telemetry.bNiiMultiple,
        qibMultiple: telemetry.qibMultiple,
        totalMultiple: telemetry.totalMultiple,
        updatedAt: telemetry.updatedAt,
      },
      recommendationRationale: [
        'No family PAN profiles found. Register your family PANs (Spouse, Parents, Children, HUF) to unlock probability maximization.',
      ],
    };
  }
}
