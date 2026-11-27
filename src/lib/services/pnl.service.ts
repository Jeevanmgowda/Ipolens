import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { IpoRepository } from '@/lib/repositories/ipo.repository';

/**
 * P&L sync for IPO allotments: one journal row per final application outcome, and one
 * aggregated portfolio holding per (user, IPO) for allotted shares.
 */
export class PnLCalculationService {
  static async syncUserPnL(userId: string): Promise<{ journalRows: number; holdings: number }> {
    const db = getDb();
    const apps = await db
      .select()
      .from(schema.ipoApplicationsTable)
      .where(eq(schema.ipoApplicationsTable.userId, userId));
    const finals = apps.filter((a) => a.allotmentStatus === 'ALLOTTED' || a.allotmentStatus === 'NOT_ALLOTTED');

    const bySymbol = new Map<string, { shares: number; invested: number; companyName: string }>();
    for (const a of finals) {
      const ipo = await IpoRepository.getBySymbol(a.ipoSymbol);
      const issuePrice = ipo?.issuePrice ?? ipo?.priceHigh ?? Number(a.bidPrice);
      const allotted = a.allotmentStatus === 'ALLOTTED' ? a.allottedShares ?? 0 : 0;
      const invested = allotted * issuePrice;
      const refund = Math.max(0, Number(a.blockedAmount) - invested);
      const listingPrice = ipo?.listingPrice ?? null;
      const values = {
        userId,
        applicationId: a.id,
        symbol: a.ipoSymbol,
        sharesApplied: a.shares,
        sharesAllotted: allotted,
        issuePrice: issuePrice.toFixed(2),
        investedAmount: invested.toFixed(2),
        refundAmount: refund.toFixed(2),
        listingPrice: listingPrice !== null ? listingPrice.toFixed(2) : null,
        listingGainAmount: listingPrice !== null ? ((listingPrice - issuePrice) * allotted).toFixed(2) : null,
        updatedAt: new Date(),
      };
      await db
        .insert(schema.portfolioPnlJournalTable)
        .values(values)
        .onConflictDoUpdate({ target: schema.portfolioPnlJournalTable.applicationId, set: values });

      if (allotted > 0) {
        const cur = bySymbol.get(a.ipoSymbol) || { shares: 0, invested: 0, companyName: a.companyName };
        cur.shares += allotted;
        cur.invested += invested;
        bySymbol.set(a.ipoSymbol, cur);
      }
    }

    for (const [symbol, agg] of bySymbol) {
      const ipo = await IpoRepository.getBySymbol(symbol);
      const avg = agg.invested / agg.shares;
      const current = ipo?.listingPrice ?? avg;
      const id = `ipo_${userId}_${symbol}`.slice(0, 64);
      const values = {
        id,
        userId,
        symbol,
        isin: ipo?.isin || '-',
        companyName: agg.companyName,
        quantity: agg.shares,
        averageBuyPrice: avg.toFixed(2),
        currentPrice: current.toFixed(2),
        isIpoAllotment: true,
        importedFromBroker: 'IPO allotment',
        updatedAt: new Date(),
      };
      await db
        .insert(schema.portfolioHoldingsTable)
        .values(values)
        .onConflictDoUpdate({
          target: schema.portfolioHoldingsTable.id,
          set: { quantity: values.quantity, averageBuyPrice: values.averageBuyPrice, currentPrice: values.currentPrice, updatedAt: values.updatedAt },
        });
    }
    return { journalRows: finals.length, holdings: bySymbol.size };
  }

  static async journalFor(userId: string, applicationId: string) {
    const rows = await getDb()
      .select()
      .from(schema.portfolioPnlJournalTable)
      .where(and(eq(schema.portfolioPnlJournalTable.userId, userId), eq(schema.portfolioPnlJournalTable.applicationId, applicationId)))
      .limit(1);
    return rows[0] ?? null;
  }
}
