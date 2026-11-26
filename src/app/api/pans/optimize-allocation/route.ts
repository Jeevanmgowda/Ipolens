import { NextResponse } from 'next/server';
import {
  AllocationOptimizerService,
  OptimizationStrategy,
} from '@/lib/services/allocation-optimizer.service';
import { ExchangeIngestionService } from '@/lib/services/exchange-ingestion.service';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/security/session';
import { sanitizeString } from '@/lib/security/sanitize';
import { publicErrorMessage } from '@/lib/security/apiError';
import { OptimizeAllocationSchema, firstIssue } from '@/lib/security/schemas';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const parsedBody = OptimizeAllocationSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
      return NextResponse.json({ success: false, error: firstIssue(parsedBody.error) }, { status: 400 });
    }
    const body = parsedBody.data;
    const cleanPrice = Number(body.price) || 500;
    const defaultLot = Math.max(1, Math.floor(15000 / cleanPrice));
    const cleanLotSize = Number(body.lotSize) > 0 ? Number(body.lotSize) : defaultLot;

    const {
      symbol = 'IPO',
      companyName = 'IPO Offering',
      gmp = 0,
      totalBudget = 500000,
      strategy: rawStrategy,
      selectedPanIds,
    } = body;
    const strategy: OptimizationStrategy = (['max_probability', 'max_expected_profit', 'capital_efficient'] as const).includes(
      rawStrategy as OptimizationStrategy
    )
      ? (rawStrategy as OptimizationStrategy)
      : 'max_probability';

    // 1. Fetch live subscription telemetry
    const subscription = await ExchangeIngestionService.syncLiveSubscription(sanitizeString(symbol));

    // 2. Resolve family PAN profiles: only the signed-in user's own PANs.
    //    Client-supplied PAN lists are never trusted.
    let profiles = await DbRepositoryService.getPans(user.id);

    // Filter by selectedPanIds if specified
    if (Array.isArray(selectedPanIds) && selectedPanIds.length > 0) {
      profiles = profiles.filter((p) => selectedPanIds.includes(p.id));
    }

    // 3. Execute mathematical allocation optimization
    const result = AllocationOptimizerService.optimize({
      symbol: sanitizeString(symbol),
      companyName: sanitizeString(companyName),
      price: cleanPrice,
      lotSize: cleanLotSize,
      gmp: Number(gmp) || 0,
      totalBudget: Number(totalBudget) || 500000,
      strategy,
      pans: profiles,
      subscription,
    });

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in /api/pans/optimize-allocation:', error);
    return NextResponse.json(
      {
        success: false,
        error: publicErrorMessage(error, 'Failed to optimize multi-PAN allocation'),
      },
      { status: 500 }
    );
  }
}
