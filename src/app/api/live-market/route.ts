import { NextResponse } from 'next/server';
import { IpoService } from '@/services/ipoService';
import { handleRouteError } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [overview, alerts] = await Promise.all([IpoService.getOverview(), IpoService.getAlerts()]);
    return NextResponse.json({ ...overview, alerts });
  } catch (err) {
    return handleRouteError(err, 'live-market');
  }
}
