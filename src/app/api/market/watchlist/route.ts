import { NextResponse } from 'next/server';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { WatchlistBodySchema, firstIssue } from '@/lib/security/schemas';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/security/session';
import { publicErrorMessage } from '@/lib/security/apiError';

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
    return NextResponse.json({ success: false, error: publicErrorMessage(error) }, { status: 500 });
  }
}
