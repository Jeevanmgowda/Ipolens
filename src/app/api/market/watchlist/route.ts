import { NextResponse } from 'next/server';
import { z } from 'zod';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { requireUser } from '@/lib/security/session';
import { handleRouteError } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const symbols = await DbRepositoryService.getWatchlist(user.id);
    return NextResponse.json({ success: true, data: symbols, symbols });
  } catch (err) {
    return handleRouteError(err, 'watchlist:GET');
  }
}

const Body = z.object({ symbol: z.string().trim().min(1).max(32), companyName: z.string().trim().max(256).optional() });

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const { symbol, companyName } = Body.parse(await request.json());
    const result = await DbRepositoryService.toggleWatchlist(user.id, symbol, companyName);
    return NextResponse.json({
      success: true,
      action: result.watchlisted ? 'added' : 'removed',
      symbol: result.symbol,
      watchlisted: result.watchlisted,
    });
  } catch (err) {
    return handleRouteError(err, 'watchlist:POST');
  }
}
