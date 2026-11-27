import { NextResponse } from 'next/server';
import { getAnchorLockInSchedule } from '@/services/anchorLockInService';
import { handleRouteError } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const symbol = new URL(request.url).searchParams.get('symbol') || undefined;
    const data = await getAnchorLockInSchedule(symbol);
    return NextResponse.json({ success: true, data, count: data.length });
  } catch (err) {
    return handleRouteError(err, 'ipos/anchor-lockin');
  }
}
