import { NextResponse } from 'next/server';
import { userHoldingsStore } from '../upload/route';
import { PortfolioSummary } from '@/types/portfolio';

export async function GET() {
  const holdings = userHoldingsStore;

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
  const totalUnrealizedPnlPercent = totalInvested > 0 ? (totalUnrealizedPnl / totalInvested) * 100 : 0;

  const summary: PortfolioSummary = {
    totalInvested: Math.round(totalInvested * 100) / 100,
    totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
    totalUnrealizedPnl: Math.round(totalUnrealizedPnl * 100) / 100,
    totalUnrealizedPnlPercent: Math.round(totalUnrealizedPnlPercent * 100) / 100,
    totalHoldingsCount: holdings.length,
    ipoAllotmentCount,
    dayPnl: Math.round(totalCurrentValue * 0.012 * 100) / 100, // Estimated active market session drift
    dayPnlPercent: 1.2,
  };

  return NextResponse.json({
    success: true,
    data: {
      summary,
      holdings,
    },
  });
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id === 'all') {
      userHoldingsStore.length = 0;
      return NextResponse.json({ success: true, message: 'All holdings cleared' });
    }

    if (id) {
      const idx = userHoldingsStore.findIndex((h) => h.id === id);
      if (idx !== -1) {
        userHoldingsStore.splice(idx, 1);
        return NextResponse.json({ success: true, message: 'Holding removed' });
      }
    }

    return NextResponse.json({ success: false, error: 'Holding not found' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
