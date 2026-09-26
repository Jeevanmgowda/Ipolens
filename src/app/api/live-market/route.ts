import { NextResponse } from 'next/server';
import { IpoService } from '@/services/ipoService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const overview = await IpoService.getOverview();
    const alerts = IpoService.getAlerts();

    return NextResponse.json({
      ...overview,
      alerts,
    });
  } catch (error: any) {
    console.error('API Error in /api/live-market:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate live market overview', message: error.message },
      { status: 500 }
    );
  }
}
