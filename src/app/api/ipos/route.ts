import { NextRequest, NextResponse } from 'next/server';
import { IpoAggregatorService } from '@/lib/services/ipo-aggregator.service';
import { IpoStatus, IssueType } from '@/types/ipo';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawStatus = searchParams.get('status') || 'open';
    const rawType = searchParams.get('type') as IssueType | null;

    const validStatuses: IpoStatus[] = ['upcoming', 'open', 'closed', 'listed'];
    const status: IpoStatus = validStatuses.includes(rawStatus as IpoStatus)
      ? (rawStatus as IpoStatus)
      : 'open';

    const issueType: IssueType | undefined =
      rawType === 'regular' || rawType === 'sme' ? rawType : undefined;

    const data = await IpoAggregatorService.getUnifiedIpos(status, issueType);

    return NextResponse.json({
      success: true,
      status,
      issueType: issueType || 'all',
      count: data.length,
      data,
    });
  } catch (error: any) {
    console.error('API Error in GET /api/ipos:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch unified IPO pipeline',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
