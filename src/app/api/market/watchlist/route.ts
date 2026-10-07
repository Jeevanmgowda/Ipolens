import { NextResponse } from 'next/server';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { getAuthenticatedUser } from '@/lib/security/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  const userId = user ? user.id : 'default_user';

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
    const user = await getAuthenticatedUser(request);
    const userId = user ? user.id : 'default_user';

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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
