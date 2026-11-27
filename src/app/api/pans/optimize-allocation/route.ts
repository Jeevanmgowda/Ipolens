import { NextResponse } from 'next/server';
import {
  AllocationOptimizerService,
  OptimizationStrategy,
} from '@/lib/services/allocation-optimizer.service';
import { ExchangeIngestionService } from '@/lib/services/exchange-ingestion.service';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { requireUserOr401 } from '@/lib/security/guards';
import { FamilyPanProfile } from '@/types/pan';
import { sanitizeString } from '@/lib/security/sanitize';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const auth = await requireUserOr401(request);
    if (!auth.user) return auth.response;
    const body = await request.json();
    const cleanPrice = Number(body.price) || 500;
    const defaultLot = Math.max(1, Math.floor(15000 / cleanPrice));
    const cleanLotSize = Number(body.lotSize) > 0 ? Number(body.lotSize) : defaultLot;

    const {
      symbol = 'IPO',
      companyName = 'IPO Offering',
      gmp = 0,
      totalBudget = 500000,
      strategy = 'max_probability' as OptimizationStrategy,
      selectedPanIds,
    } = body;

    // 1. Fetch live subscription telemetry
    const subscription = await ExchangeIngestionService.syncLiveSubscription(sanitizeString(symbol));

    // 2. Resolve family PAN profiles
    // Only the caller's own PAN profiles, loaded server-side. Client-supplied PAN lists are ignored.
    let profiles: FamilyPanProfile[] = await DbRepositoryService.getPans(auth.user.id);

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
    return NextResponse.json({ success: false, error: 'Failed to optimize multi-PAN allocation' }, { status: 500 });
  }
}
