import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Global memory watchlist fallback
const inMemoryWatchlist = new Set<string>(['SWIGGY', 'BAJAJHFL', 'DEMOTECH']);

export async function GET() {
  return NextResponse.json({
    success: true,
    data: Array.from(inMemoryWatchlist),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { symbol } = body;

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol is required' }, { status: 400 });
    }

    const clean = symbol.toUpperCase().trim();
    if (inMemoryWatchlist.has(clean)) {
      inMemoryWatchlist.delete(clean);
      return NextResponse.json({ success: true, action: 'removed', symbol: clean, watchlisted: false });
    } else {
      inMemoryWatchlist.add(clean);
      return NextResponse.json({ success: true, action: 'added', symbol: clean, watchlisted: true });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
