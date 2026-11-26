import { NextResponse } from 'next/server';
import { IpoService } from '@/lib/services/ipoService';
import { errorDetail } from '@/lib/security/apiError';

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
      { success: false, error: 'Failed to generate live market overview', ...errorDetail(error) },
      { status: 500 }
    );
  }
}
