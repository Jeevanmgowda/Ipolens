import { NextResponse } from 'next/server';
import { IpoRepository } from '@/lib/repositories/ipo.repository';
import type { IpoLifecycleStatus } from '@/types/liveMarket';
import { handleRouteError } from '@/lib/http';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, IpoLifecycleStatus> = {
  upcoming: 'Upcoming',
  open: 'Open',
  closed: 'Closed',
  listed: 'Listed',
};

/** GET /api/ipos?status=open|upcoming|closed|listed|all&series=EQ|SME&q=search */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawStatus = (searchParams.get('status') || 'all').toLowerCase();
    const series = searchParams.get('series')?.toUpperCase();
    const q = searchParams.get('q')?.toLowerCase().trim();

    let data = await IpoRepository.listView(STATUS[rawStatus] ? { status: STATUS[rawStatus] } : undefined);
    if (series === 'EQ' || series === 'SME') data = data.filter((d) => d.series === series);
    if (q) data = data.filter((d) => d.symbol.toLowerCase().includes(q) || d.companyName.toLowerCase().includes(q));

    return NextResponse.json({ success: true, status: rawStatus, count: data.length, data });
  } catch (err) {
    return handleRouteError(err, 'ipos:GET');
  }
}
