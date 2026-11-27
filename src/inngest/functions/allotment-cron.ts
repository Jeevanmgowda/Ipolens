import { and, asc, eq, lt, lte, sql, isNotNull } from 'drizzle-orm';
import { inngest } from '../client';
import { getDb, schema } from '@/db';
import { todayIst } from '@/lib/repositories/ipo.repository';
import { AllotmentGatewayService } from '@/lib/services/allotment/allotment-gateway.service';
import { notifyAllotmentOutcome } from '@/lib/services/notification.service';
import { MAX_ATTEMPTS } from '@/lib/services/allotment/config';

/** Up to 50 PENDING applications whose allotment date has arrived, oldest check first. */
export async function selectDueApplications(limit = 50, now = new Date()) {
  return getDb()
    .select({
      id: schema.ipoApplicationsTable.id,
      userId: schema.ipoApplicationsTable.userId,
      symbol: schema.ipoApplicationsTable.ipoSymbol,
      companyName: schema.ipoApplicationsTable.companyName,
      holderName: schema.ipoApplicationsTable.holderName,
      panNumber: schema.ipoApplicationsTable.panNumber,
    })
    .from(schema.ipoApplicationsTable)
    .innerJoin(schema.iposTable, eq(schema.iposTable.symbol, schema.ipoApplicationsTable.ipoSymbol))
    .where(
      and(
        eq(schema.ipoApplicationsTable.allotmentStatus, 'PENDING'),
        isNotNull(schema.iposTable.allotmentDate),
        lte(schema.iposTable.allotmentDate, todayIst(now)),
        lt(schema.ipoApplicationsTable.attemptCount, MAX_ATTEMPTS)
      )
    )
    .orderBy(sql`${schema.ipoApplicationsTable.checkedAt} asc nulls first`, asc(schema.ipoApplicationsTable.appliedAt))
    .limit(limit);
}

/**
 * Allotment polling: every 30 minutes, 08:00 to 23:30 IST. Each application runs in its own
 * step so Inngest retries them individually; a final outcome fans out to all channels.
 */
export const allotmentCron = inngest.createFunction(
  { id: 'allotment-cron', concurrency: { limit: 1 }, triggers: [{ cron: 'TZ=Asia/Kolkata */30 8-23 * * *' }] },
  async ({ step }) => {
    const due = await step.run('select-pending', () => selectDueApplications(50));
    let finals = 0;
    for (const app of due) {
      const r = await step.run(`verify-${app.id}`, async () => {
        const result = await new AllotmentGatewayService().verifyApplication(app.id);
        return { status: result.status, transitioned: result.transitioned, sharesAllotted: result.sharesAllotted, refundAmount: result.refundAmount ?? 0 };
      });
      if (r.transitioned && (r.status === 'ALLOTTED' || r.status === 'NOT_ALLOTTED')) {
        finals++;
        await step.run(`notify-${app.id}`, () =>
          notifyAllotmentOutcome({
            applicationId: app.id,
            userId: app.userId,
            outcome: r.status as 'ALLOTTED' | 'NOT_ALLOTTED',
            symbol: app.symbol,
            companyName: app.companyName,
            holderName: app.holderName,
            panMasked: app.panNumber,
            sharesAllotted: r.sharesAllotted,
            refundAmount: r.refundAmount,
          })
        );
      }
    }
    return { checked: due.length, finals };
  }
);
