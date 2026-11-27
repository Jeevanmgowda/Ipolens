import { NextResponse } from 'next/server';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { requireUser } from '@/lib/security/session';
import { handleRouteError } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await requireUser(request);
  const userId = user.id;

  const symbols = await DbRepositoryService.getWatchlist(userId);

  return NextResponse.json({
    success: true,
    data: symbols,
    symbols,
    userId,
  });
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const userId = user.id;

    const body = await request.json();
    const { symbol, companyName } = body;

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol is required' }, { status: 400 });
    }

    const result = await DbRepositoryService.toggleWatchlist(userId, symbol, companyName);

    return NextResponse.json({
      success: true,
      action: result.watchlisted ? 'added' : 'removed',
      symbol: result.symbol,
      watchlisted: result.watchlisted,
    });
  } catch (error) {
    return handleRouteError(error, 'src/app/api/market/watchlist/route.ts');
  }
}
