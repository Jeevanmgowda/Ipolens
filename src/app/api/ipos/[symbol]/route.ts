import { NextResponse } from 'next/server';
import { IpoService } from '@/services/ipoService';
import { IpoRepository } from '@/lib/repositories/ipo.repository';
import { handleRouteError, jsonError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** Full IPO record: issue details, latest subscription and real GMP history. */
export async function GET(_request: Request, props: { params: Promise<{ symbol: string }> }) {
  try {
    const { symbol } = await props.params;
    const item = await IpoService.getIpoDetails(symbol);
    if (!item) return jsonError(404, `IPO "${symbol}" is not in the live IPO directory.`);

    const [subscription, gmpHistory] = await Promise.all([
      IpoService.getSubscription(item.symbol),
      IpoRepository.gmpHistory(item.symbol),
    ]);
    return NextResponse.json({ success: true, data: { ...item, subscription, gmpHistory }, source: item.source });
  } catch (err) {
    return handleRouteError(err, 'ipos/[symbol]:GET');
  }
}
