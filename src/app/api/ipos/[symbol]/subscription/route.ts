import { NextResponse } from 'next/server';
<<<<<<< HEAD
import { IpoService } from '@/services/ipoService';
=======
import { IpoService } from '@/lib/services/ipoService';
>>>>>>> origin/main
import { errorDetail } from '@/lib/security/apiError';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  props: { params: Promise<{ symbol: string }> }
) {
  try {
    const params = await props.params;
    const symbol = params.symbol;

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol parameter is required' }, { status: 400 });
    }

    const subscription = await IpoService.getSubscription(symbol);

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: `Subscription data for "${symbol}" is not available.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: subscription,
    });
  } catch (error: any) {
    console.error('API Error in /api/ipos/[symbol]/subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription breakdown', ...errorDetail(error) },
      { status: 500 }
    );
  }
}
