import { NextResponse } from 'next/server';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { requireUser } from '@/lib/security/session';
import { handleRouteError } from '@/lib/http';
import { PortfolioSummary } from '@/types/portfolio';

export async function GET(request: Request) {
  try {
    const authUser = await requireUser(request);
    const userId = authUser.id;

    const holdings = await DbRepositoryService.getHoldings(userId);

    let totalInvested = 0;
    let totalCurrentValue = 0;
    let ipoAllotmentCount = 0;

    for (const h of holdings) {
      totalInvested += h.investedValue;
      totalCurrentValue += h.currentValue;
      if (h.isIpoAllotment) {
        ipoAllotmentCount++;
      }
    }

    const totalUnrealizedPnl = totalCurrentValue - totalInvested;
    const totalUnrealizedPnlPercent =
      totalInvested > 0 ? (totalUnrealizedPnl / totalInvested) * 100 : 0;

    const summary: PortfolioSummary = {
      totalInvested: Math.round(totalInvested * 100) / 100,
      totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
      totalUnrealizedPnl: Math.round(totalUnrealizedPnl * 100) / 100,
      totalUnrealizedPnlPercent: Math.round(totalUnrealizedPnlPercent * 100) / 100,
      totalHoldingsCount: holdings.length,
      ipoAllotmentCount,
      dayPnl: null,
      dayPnlPercent: null,
    };

    return NextResponse.json({
      success: true,
      data: {
        summary,
        holdings,
      },
    });
  } catch (err) {
    return handleRouteError(err, 'src/app/api/portfolio/holdings/route.ts');
  }
}

export async function DELETE(request: Request) {
  try {
    const authUser = await requireUser(request);
    const userId = authUser.id;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id === 'all') {
      await DbRepositoryService.clearHoldings(userId);
      return NextResponse.json({ success: true, message: 'All holdings cleared' });
    }

    if (id) {
      const removed = await DbRepositoryService.deleteHolding(id, userId);
      if (removed) {
        return NextResponse.json({ success: true, message: 'Holding removed' });
      }
    }

    return NextResponse.json({ success: false, error: 'Holding not found' }, { status: 404 });
  } catch (err) {
    return handleRouteError(err, 'src/app/api/portfolio/holdings/route.ts');
  }
}
