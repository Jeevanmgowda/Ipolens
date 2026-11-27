import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/security/session';
import { checkDistributedRateLimit, applyRateLimitHeaders } from '@/lib/security/rateLimiter';
import { handleRouteError, jsonError } from '@/lib/http';
import { AllotmentGatewayService } from '@/lib/services/allotment/allotment-gateway.service';
import { notifyAllotmentOutcome } from '@/lib/services/notification.service';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { PAN_REGEX } from '@/lib/services/allotment/helpers';

export const dynamic = 'force-dynamic';

const Body = z.union([
  z.object({ applicationId: z.string().min(1).max(64) }),
  z.object({
    symbol: z.string().trim().min(1).max(32),
    pan: z.string().trim().toUpperCase().regex(PAN_REGEX, 'PAN must look like ABCDE1234F'),
  }),
]);

/**
 * POST /api/allotment/check
 *  { applicationId }  -> verify one of the signed-in user's applications (persisted, notified)
 *  { symbol, pan }    -> ad-hoc check of any PAN (not persisted)
 * Returns 200 for all four outcomes, including MANUAL_VERIFICATION_REQUIRED with the registrar link.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const limit = await checkDistributedRateLimit(`allotment:${user.id}`, 10, 60);
    if (!limit.allowed) {
      const res = jsonError(429, `Too many checks. Retry in ${limit.resetSeconds}s.`);
      applyRateLimitHeaders(res.headers, limit);
      return res;
    }

    const body = Body.parse(await request.json());
    const gateway = new AllotmentGatewayService();

    if ('applicationId' in body) {
      const app = await DbRepositoryService.getApplicationForUser(body.applicationId, user.id);
      if (!app) return jsonError(404, 'Application not found.');
      const result = await gateway.verifyApplication(app.id, { userId: user.id });
      if (result.transitioned && (result.status === 'ALLOTTED' || result.status === 'NOT_ALLOTTED')) {
        await notifyAllotmentOutcome({
          applicationId: app.id,
          userId: user.id,
          outcome: result.status,
          symbol: app.ipoSymbol,
          companyName: app.companyName,
          holderName: app.holderName,
          panMasked: app.panNumber,
          sharesAllotted: result.sharesAllotted,
          refundAmount: result.refundAmount ?? 0,
        }).catch(() => undefined);
      }
      return NextResponse.json({ success: true, data: result });
    }

    const result = await gateway.checkPan(body.symbol.toUpperCase(), body.pan);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleRouteError(err, 'allotment/check');
  }
}
