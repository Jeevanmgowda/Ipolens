import { NextRequest, NextResponse } from 'next/server';
import { IpoLiveService } from '@/lib/services/ipo-live.service';
import { errorDetail } from '@/lib/security/apiError';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawStatus = (searchParams.get('status') || 'ALL').toUpperCase();
    const refresh = searchParams.get('refresh') === 'true';

    const validStatuses = ['ALL', 'OPEN', 'UPCOMING', 'CLOSED', 'LISTED'] as const;
    const status = (validStatuses.includes(rawStatus as (typeof validStatuses)[number])
      ? rawStatus
      : 'ALL') as (typeof validStatuses)[number];

    const result = await IpoLiveService.getIpos({ status, refresh });

    return NextResponse.json({
      success: true,
      status,
      stale: result.stale,
      source: result.source,
      fetchedAt: result.fetchedAt,
      count: result.items.length,
      data: result.items,
    });
  } catch (error: unknown) {
    console.error('API Error in GET /api/ipos:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch live IPO pipeline',
        ...errorDetail(error),
      },
      { status: 500 }
    );
  }
}
