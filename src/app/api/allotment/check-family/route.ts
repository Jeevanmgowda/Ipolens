import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/security/session';
import { checkDistributedRateLimit } from '@/lib/security/rateLimiter';
import { handleRouteError, jsonError } from '@/lib/http';
import { checkFamilyAllotment } from '@/lib/services/allotment/family-check.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const Body = z.object({ symbol: z.string().trim().min(1).max(32) });

/** Checks allotment for every family PAN application the user recorded for one IPO. */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const limit = await checkDistributedRateLimit(`allotment-family:${user.id}`, 6, 60);
    if (!limit.allowed) return jsonError(429, `Too many family checks. Retry in ${limit.resetSeconds}s.`);
    const { symbol } = Body.parse(await request.json());
    const summary = await checkFamilyAllotment(user.id, symbol.toUpperCase());
    if (!summary) return jsonError(404, `No applications or IPO found for ${symbol}.`);
    if (!summary.members.length) {
      return jsonError(404, `You have not recorded any family PAN applications for ${summary.companyName}. Add them in the PAN tab first.`);
    }
    return NextResponse.json({ success: true, data: summary });
  } catch (err) {
    return handleRouteError(err, 'allotment/check-family');
  }
}
