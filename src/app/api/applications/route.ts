import { NextResponse } from 'next/server';
import { z } from 'zod';
import { IpoApplication } from '@/types/pan';
import { checkDuplicatePanBid } from '@/services/duplicateEnforcer';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { IpoRepository } from '@/lib/repositories/ipo.repository';
import { requireUser } from '@/lib/security/session';
import { handleRouteError, jsonError } from '@/lib/http';

const CreateApplication = z.object({
  ipoSymbol: z.string().trim().min(1).max(32),
  panId: z.string().trim().min(1).max(64),
  category: z.enum(['Retail', 'sNII', 'bNII', 'Employee']).default('Retail'),
  lots: z.coerce.number().int().min(1).max(10000),
  bidPrice: z.coerce.number().positive().optional(),
});

const UpdateApplication = z.object({
  id: z.string().min(1).max(64),
  status: z.enum(['Applied', 'Mandate Approved', 'Refunded']),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const symbol = new URL(request.url).searchParams.get('symbol') || undefined;
    const list = await DbRepositoryService.getApplications(user.id, symbol);
    return NextResponse.json({ success: true, data: list, count: list.length });
  } catch (err) {
    return handleRouteError(err, 'applications:GET');
  }
}

/**
 * Records an application for one of the user's own PAN profiles. Lot size and price band come
 * from the live IPO record, never from the client.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = CreateApplication.parse(await request.json());
    const symbol = body.ipoSymbol.toUpperCase();

    const [ipo, pans, existingApps] = await Promise.all([
      IpoRepository.getBySymbol(symbol),
      DbRepositoryService.getPans(user.id),
      DbRepositoryService.getApplications(user.id, symbol),
    ]);
    if (!ipo) return jsonError(404, `IPO ${symbol} was not found in the live IPO directory.`);
    if (!ipo.lotSize || !ipo.priceHigh) {
      return jsonError(422, `${symbol} has no published lot size / price band yet.`);
    }
    const pan = pans.find((p) => p.id === body.panId);
    if (!pan) return jsonError(404, 'PAN profile not found.');

    const dup = checkDuplicatePanBid(existingApps, pan.id, symbol, pan.pan, pan.name);
    if (dup.hasDuplicate) {
      return jsonError(409, dup.message, { isDuplicateBid: true, duplicatePan: dup.duplicatePan });
    }

    const bidPrice = body.bidPrice ?? ipo.priceHigh;
    if (ipo.priceLow && (bidPrice < ipo.priceLow || bidPrice > ipo.priceHigh)) {
      return jsonError(400, `Bid price must be within the price band Rs ${ipo.priceLow} to Rs ${ipo.priceHigh}.`);
    }
    const shares = body.lots * ipo.lotSize;

    const app: IpoApplication = {
      id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ipoSymbol: symbol,
      companyName: ipo.companyName,
      panId: pan.id,
      panNumber: pan.pan,
      holderName: pan.name,
      relationship: pan.relationship,
      category: body.category,
      lots: body.lots,
      shares,
      bidPrice,
      blockedAmount: shares * bidPrice,
      status: 'Applied',
      allotmentStatus: 'PENDING',
      appliedAt: new Date().toISOString(),
    };
    await DbRepositoryService.saveApplication(app, user.id);
    return NextResponse.json({
      success: true,
      data: app,
      message: `Application recorded for ${app.holderName} (${app.panNumber}). Blocked amount: Rs ${app.blockedAmount.toLocaleString('en-IN')}.`,
    });
  } catch (err) {
    return handleRouteError(err, 'applications:POST');
  }
}

/** Lifecycle updates only. Allotment outcomes are set exclusively by the allotment gateway. */
export async function PATCH(request: Request) {
  try {
    const user = await requireUser(request);
    const body = UpdateApplication.parse(await request.json());
    const updated = await DbRepositoryService.updateApplicationLifecycle(body.id, user.id, body.status);
    if (!updated) return jsonError(404, 'Application not found.');
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return handleRouteError(err, 'applications:PATCH');
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return jsonError(400, 'ID is required');
    const deleted = await DbRepositoryService.deleteApplication(id, user.id);
    if (!deleted) return jsonError(404, 'Application not found.');
    return NextResponse.json({ success: true, message: 'Application removed.' });
  } catch (err) {
    return handleRouteError(err, 'applications:DELETE');
  }
}
