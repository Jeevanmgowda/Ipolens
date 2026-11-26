import { NextResponse } from 'next/server';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/security/session';
import { apiErrorResponse } from '@/lib/security/apiError';
import { WatchlistBodySchema, firstIssue } from '@/lib/security/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();
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
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();
    const userId = user.id;

    const parsed = WatchlistBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 });
    }
    const { symbol, companyName } = parsed.data;

    const result = await DbRepositoryService.toggleWatchlist(userId, symbol, companyName);

    return NextResponse.json({
      success: true,
      action: result.watchlisted ? 'added' : 'removed',
      symbol: result.symbol,
      watchlisted: result.watchlisted,
    });
  } catch (error: any) {
    return apiErrorResponse(error, '/api/market/watchlist');
  }
}
