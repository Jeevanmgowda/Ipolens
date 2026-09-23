import { NextResponse } from 'next/server';
import {
  AllocationOptimizerService,
  OptimizationStrategy,
} from '@/lib/services/allocation-optimizer.service';
import { ExchangeIngestionService } from '@/lib/services/exchange-ingestion.service';
import { getUserPansStore } from '../route';
import { FamilyPanProfile } from '@/types/pan';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      symbol = 'NSE',
      companyName = 'National Stock Exchange of India Ltd',
      price = 1785,
      lotSize = 14,
      gmp = 450,
      totalBudget = 500000,
      strategy = 'max_probability' as OptimizationStrategy,
      selectedPanIds,
      pans: clientPans,
    } = body;

    // 1. Fetch live subscription telemetry
    const subscription = await ExchangeIngestionService.syncLiveSubscription(symbol);

    // 2. Resolve family PAN profiles
    let profiles: FamilyPanProfile[] = [];
    if (Array.isArray(clientPans) && clientPans.length > 0) {
      profiles = clientPans;
    } else {
      profiles = getUserPansStore();
    }

    // Filter by selectedPanIds if specified
    if (Array.isArray(selectedPanIds) && selectedPanIds.length > 0) {
      profiles = profiles.filter((p) => selectedPanIds.includes(p.id));
    }

    // 3. Execute mathematical allocation optimization
    const result = AllocationOptimizerService.optimize({
      symbol,
      companyName,
      price: Number(price) || 1785,
      lotSize: Number(lotSize) || 14,
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
