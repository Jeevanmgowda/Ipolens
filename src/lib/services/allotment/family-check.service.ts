import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { IpoRepository } from '@/lib/repositories/ipo.repository';
import { notifyAllotmentOutcome } from '@/lib/services/notification.service';
import { AllotmentGatewayService, type VerifyResult } from './allotment-gateway.service';

/**
 * Family multi-PAN allotment check: verifies every application the user recorded for one IPO
 * (one per family PAN) with bounded concurrency, and returns a per-member table plus totals.
 */

export interface FamilyMemberResult extends VerifyResult {
  holderName: string;
  relationship: string;
  category: string;
  lots: number;
  blockedAmount: number;
}

export interface FamilyCheckSummary {
  symbol: string;
  companyName: string;
  allotmentDate: string | null;
  members: FamilyMemberResult[];
  totals: {
    applications: number;
    allotted: number;
    notAllotted: number;
    pending: number;
    manual: number;
    sharesAllotted: number;
    investedAtIssuePrice: number;
    refundDue: number;
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
        // small jitter so a family check never bursts the registrar
        await new Promise((r) => setTimeout(r, 150 + Math.random() * 250));
      }
    })
  );
  return out;
}

export async function checkFamilyAllotment(
  userId: string,
  symbol: string,
  gateway = new AllotmentGatewayService()
): Promise<FamilyCheckSummary | null> {
  const [ipo, apps] = await Promise.all([IpoRepository.getBySymbol(symbol), DbRepositoryService.getApplications(userId, symbol)]);
  if (!ipo && !apps.length) return null;
  const issuePrice = ipo?.issuePrice ?? ipo?.priceHigh ?? null;

  const members = await mapLimit(apps, 2, async (app) => {
    const r = await gateway.verifyApplication(app.id, { userId });
    if (r.transitioned && (r.status === 'ALLOTTED' || r.status === 'NOT_ALLOTTED')) {
      await notifyAllotmentOutcome({
        applicationId: app.id,
        userId,
        outcome: r.status,
        symbol: app.ipoSymbol,
        companyName: app.companyName,
        holderName: app.holderName,
        panMasked: app.panNumber,
        sharesAllotted: r.sharesAllotted,
        refundAmount: r.refundAmount ?? 0,
      }).catch(() => undefined);
    }
    return {
      ...r,
      holderName: app.holderName,
      relationship: app.relationship,
      category: app.category,
      lots: app.lots,
      blockedAmount: app.blockedAmount,
    } satisfies FamilyMemberResult;
  });

  const sharesAllotted = members.reduce((s, m) => s + m.sharesAllotted, 0);
  const invested = issuePrice ? sharesAllotted * issuePrice : 0;
  const finalMembers = members.filter((m) => m.status === 'ALLOTTED' || m.status === 'NOT_ALLOTTED');
  const refundDue = finalMembers.reduce((s, m) => s + Math.max(0, m.blockedAmount - (issuePrice ? m.sharesAllotted * issuePrice : 0)), 0);

  return {
    symbol: ipo?.symbol ?? symbol.toUpperCase(),
    companyName: ipo?.companyName ?? apps[0]?.companyName ?? symbol,
    allotmentDate: ipo?.allotmentDate ?? null,
    members,
    totals: {
      applications: members.length,
      allotted: members.filter((m) => m.status === 'ALLOTTED').length,
      notAllotted: members.filter((m) => m.status === 'NOT_ALLOTTED').length,
      pending: members.filter((m) => m.status === 'PENDING').length,
      manual: members.filter((m) => m.status === 'MANUAL_VERIFICATION_REQUIRED').length,
      sharesAllotted,
      investedAtIssuePrice: Math.round(invested * 100) / 100,
      refundDue: Math.round(refundDue * 100) / 100,
    },
  };
}
