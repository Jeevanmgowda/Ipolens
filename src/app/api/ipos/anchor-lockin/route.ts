import { NextResponse } from 'next/server';
import { getAnchorLockInSchedule } from '@/services/anchorLockInService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || undefined;

  const data = getAnchorLockInSchedule(symbol);

  return NextResponse.json({
    success: true,
    data,
    count: data.length,
  });
}
