import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AllocationOptimizerService } from '@/lib/services/allocation-optimizer.service';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { IpoRepository } from '@/lib/repositories/ipo.repository';
import { requireUser } from '@/lib/security/session';
import { handleRouteError, jsonError } from '@/lib/http';

export const dynamic = 'force-dynamic';

const Body = z.object({
  symbol: z.string().trim().min(1).max(32),
  totalBudget: z.coerce.number().positive().max(1e9).default(500000),
  strategy: z.enum(['max_probability', 'max_expected_profit', 'capital_efficient']).default('max_probability'),
  selectedPanIds: z.array(z.string().max(64)).optional(),
  /** Expected gain per share used for expected-profit maths; defaults to the latest market GMP if any. */
  expectedGainPerShare: z.coerce.number().optional(),
});

/** Family multi-PAN allocation plan using the IPO's real price band, lot size and live subscription. */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = Body.parse(await request.json());
    const symbol = body.symbol.toUpperCase();

    const [view] = await IpoRepository.listView({ symbols: [symbol] });
    if (!view) return jsonError(404, `IPO ${symbol} not found.`);
    if (!view.priceHigh || !view.lotSize) return jsonError(422, `${symbol} has no published price band / lot size yet.`);
    if (view.currentSubscription === null) {
      return jsonError(422, `Live subscription data for ${symbol} is not available yet; the optimizer needs real demand figures.`);
    }

    let pans = await DbRepositoryService.getPans(user.id);
    if (body.selectedPanIds?.length) pans = pans.filter((p) => body.selectedPanIds!.includes(p.id));

    const nii = view.niiSubscription ?? 0;
    const result = AllocationOptimizerService.optimize({
      symbol,
      companyName: view.companyName,
      price: view.priceHigh,
      lotSize: view.lotSize,
      gmp: body.expectedGainPerShare ?? view.gmp ?? 0,
      totalBudget: body.totalBudget,
      strategy: body.strategy,
      pans,
      subscription: {
        symbol,
        qibMultiple: view.qibSubscription ?? 0,
        niiMultiple: nii,
        // The live feed reports NII as one category; sNII/bNII use the combined NII multiple.
        sNiiMultiple: nii,
        bNiiMultiple: nii,
        riiMultiple: view.retailSubscription ?? 0,
        totalMultiple: view.currentSubscription,
        updatedAt: view.subscriptionUpdatedAt || new Date().toISOString(),
        source: view.source || 'InvestorGain',
      },
    });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleRouteError(err, 'pans/optimize-allocation');
  }
}
