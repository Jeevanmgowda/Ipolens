import { NextResponse } from 'next/server';
import { IpoService } from '@/services/ipoService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const series = searchParams.get('series');

    let items = await IpoService.getUpcomingIpos();

    if (series && series !== 'all') {
      items = items.filter((item) => item.series.toUpperCase() === series.toUpperCase());
    }

    if (q) {
      const query = q.toLowerCase().trim();
      items = items.filter(
        (item) =>
          item.symbol.toLowerCase().includes(query) ||
          item.companyName.toLowerCase().includes(query)
      );
    }

    return NextResponse.json({
      success: true,
      category: 'upcoming',
      count: items.length,
      data: items,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('API Error in /api/ipos/upcoming:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch upcoming IPOs', message: error.message },
      { status: 500 }
    );
  }
}
