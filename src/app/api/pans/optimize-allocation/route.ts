import { NextResponse } from 'next/server';
import {
  AllocationOptimizerService,
  OptimizationStrategy,
} from '@/lib/services/allocation-optimizer.service';
import { ExchangeIngestionService } from '@/lib/services/exchange-ingestion.service';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/security/session';
import { FamilyPanProfile } from '@/types/pan';
import { sanitizeString } from '@/lib/security/sanitize';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

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
      pans: clientPans,
    } = body;

    // 1. Fetch live subscription telemetry
    const subscription = await ExchangeIngestionService.syncLiveSubscription(sanitizeString(symbol));

    // 2. Resolve family PAN profiles: only the caller's own, loaded server-side.
    //    Client-sent profiles are never trusted; their IDs only narrow the selection.
    let profiles: FamilyPanProfile[] = await DbRepositoryService.getPans(user.id);

    const requestedIds: string[] = Array.isArray(selectedPanIds) && selectedPanIds.length > 0
      ? selectedPanIds
      : Array.isArray(clientPans)
        ? clientPans.map((p: { id?: unknown }) => p?.id).filter((id: unknown): id is string => typeof id === 'string')
        : [];
    if (requestedIds.length > 0) {
      profiles = profiles.filter((p) => requestedIds.includes(p.id));
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
        error: error.message || 'Failed to optimize multi-PAN allocation',
      },
      { status: 500 }
    );
  }
}
