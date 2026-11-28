import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { IpoApplication } from '@/types/pan';
import { checkDuplicatePanBid, maskPan } from '@/services/duplicateEnforcer';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/security/session';
import { sanitizeString } from '@/lib/security/sanitize';
import { ApplicationCreateSchema, ApplicationPatchSchema, firstIssue } from '@/lib/security/schemas';
import { publicErrorMessage } from '@/lib/security/apiError';

// Server-side store for applications (clean slate)
let applicationsStore: IpoApplication[] = [];

export function getApplicationsStore(): IpoApplication[] {
  return applicationsStore;
}

export function updateApplicationStatus(
  id: string,
  status: IpoApplication['status'],
  allottedShares: number | undefined,
  userId: string
): boolean {
  const index = applicationsStore.findIndex((a) => a.id === id && a.userId === userId);
  if (index === -1) return false;
  applicationsStore[index].status = status;
  if (allottedShares !== undefined) {
    applicationsStore[index].allottedShares = allottedShares;
  }
  return true;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();
  const userId = user.id;

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  const list = await DbRepositoryService.getApplications(symbol || undefined, userId);

  return NextResponse.json({
    success: true,
    data: list,
    count: list.length,
    userId,
    databaseActive: DbRepositoryService.isDatabaseActive(),
  });
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();
    const userId = user.id;

    const parsed = ApplicationCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 });
    }
    const { ipoSymbol, companyName, panId, category, lots, shares, bidPrice, blockedAmount } = parsed.data;

    // The PAN profile must belong to the caller; holder name, masked PAN and
    // relationship come from that stored profile, never from the request (audit M5).
    const panProfile = (await DbRepositoryService.getPans(userId)).find((p) => p.id === panId);
    if (!panProfile) {
      return NextResponse.json({ success: false, error: 'PAN profile not found.' }, { status: 404 });
    }
    const panNumber = panProfile.pan;
    const holderName = panProfile.name;
    const relationship = panProfile.relationship;

    // Retrieve existing user applications for duplicate check
    const existingApps = await DbRepositoryService.getApplications(ipoSymbol, userId);

    // SEBI Duplicate Bid Enforcement Check!
    const dupCheck = checkDuplicatePanBid(
      existingApps,
      panId,
      ipoSymbol,
      panNumber,
      holderName
    );

    if (dupCheck.hasDuplicate) {
      return NextResponse.json(
        {
          success: false,
          error: dupCheck.message,
          isDuplicateBid: true,
          duplicatePan: dupCheck.duplicatePan,
        },
        { status: 409 } // Conflict
      );
    }

    // All numbers are schema-validated positive values (no negative shares or amounts).
    const cleanSymbol = ipoSymbol;
    const numPrice = bidPrice;
    const numLots = lots;
    const computedShares = shares ?? Math.max(1, Math.floor(15000 / numPrice)) * numLots;
    const computedBlocked = blockedAmount ?? computedShares * numPrice;

    const newApp: IpoApplication = {
      id: `app_${crypto.randomUUID()}`,
      ipoSymbol: cleanSymbol,
      companyName: sanitizeString(companyName || ipoSymbol).slice(0, 150),
      panId,
      panNumber: maskPan(panNumber),
      holderName,
      relationship,
      category: category || 'Retail',
      lots: numLots,
      shares: computedShares,
      bidPrice: numPrice,
      blockedAmount: computedBlocked,
      status: 'Applied',
      appliedAt: new Date().toISOString(),
    };

    await DbRepositoryService.saveApplication(newApp, userId);

    return NextResponse.json({
      success: true,
      data: newApp,
      message: `Application recorded successfully for ${newApp.holderName} (${newApp.panNumber}). Total blocked amount: ₹${newApp.blockedAmount.toLocaleString('en-IN')}.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: publicErrorMessage(err) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const parsed = ApplicationPatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 });
    }
    const { id, status, allottedShares } = parsed.data;

    const owned = (await DbRepositoryService.getApplications(undefined, user.id)).some((a) => a.id === id);
    if (!owned) {
      return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
    }

    const updated = await DbRepositoryService.updateApplicationStatus(
      id,
      user.id,
      status,
      allottedShares !== undefined ? Number(allottedShares) : undefined
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
    }

    const app = (await DbRepositoryService.getApplications(undefined, user.id)).find((a) => a.id === id);

    return NextResponse.json({
      success: true,
      data: app,
      message: 'Application status updated successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: publicErrorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    applicationsStore = applicationsStore.filter((a) => !(a.id === id && a.userId === user.id));

    return NextResponse.json({
      success: true,
      message: 'Application record removed.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: publicErrorMessage(err) }, { status: 500 });
  }
}
