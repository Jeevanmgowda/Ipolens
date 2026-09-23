import { NextResponse } from 'next/server';
import { fetchLiveNseIpos } from '@/services/nseIpoService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawStatus = searchParams.get('status'); // 'Active' | 'open' | 'Forthcoming' | 'upcoming' | 'Closed'
    const series = searchParams.get('series');     // 'EQ' | 'SME'
    const q = searchParams.get('q');               // Search query

    const allIpos = await fetchLiveNseIpos();

    // Compute category counts across all issues
    const counts = {
      total: allIpos.length,
      active: allIpos.filter((i) => i.status === 'Active').length,
      forthcoming: allIpos.filter((i) => i.status === 'Forthcoming').length,
      closed: allIpos.filter((i) => i.status === 'Closed').length,
    };

    let filtered = [...allIpos];

    if (rawStatus && rawStatus !== 'all') {
      const s = rawStatus.toLowerCase().trim();
      if (s === 'active' || s === 'open' || s === 'live') {
        filtered = filtered.filter((item) => item.status === 'Active');
      } else if (s === 'forthcoming' || s === 'upcoming' || s === 'future') {
        filtered = filtered.filter((item) => item.status === 'Forthcoming');
      } else if (s === 'closed' || s === 'past') {
        filtered = filtered.filter((item) => item.status === 'Closed');
      } else {
        filtered = filtered.filter((item) => item.status.toLowerCase() === s);
      }
    }

    if (series && series !== 'all') {
      filtered = filtered.filter((item) => item.series.toUpperCase() === series.toUpperCase());
    }

    if (q) {
      const query = q.toLowerCase().trim();
      filtered = filtered.filter(
        (item) =>
          item.symbol.toLowerCase().includes(query) ||
          item.companyName.toLowerCase().includes(query)
      );
    }

    return NextResponse.json({
      success: true,
      count: filtered.length,
      counts,
      data: filtered,
      timestamp: new Date().toISOString(),
      source: 'National Stock Exchange of India (NSE)',
    });
  } catch (error: any) {
    console.error('API Error in /api/ipos/live:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch live IPOs from NSE India', message: error.message },
      { status: 500 }
    );
  }
}
