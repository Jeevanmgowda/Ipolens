import { NextResponse } from 'next/server';
import { IpoApplication } from '@/types/pan';
import { checkDuplicatePanBid, maskPan } from '@/services/duplicateEnforcer';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { getAuthenticatedUser } from '@/lib/security/session';

// Server-side store for applications (clean slate)
let applicationsStore: IpoApplication[] = [];

export function getApplicationsStore(): IpoApplication[] {
  return applicationsStore;
}

export function updateApplicationStatus(
  id: string,
  status: IpoApplication['status'],
  allottedShares?: number
): boolean {
  const index = applicationsStore.findIndex((a) => a.id === id);
  if (index === -1) return false;
  applicationsStore[index].status = status;
  if (allottedShares !== undefined) {
    applicationsStore[index].allottedShares = allottedShares;
  }
  return true;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  const userId = user ? user.id : 'default_user';

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
    const userId = user ? user.id : 'default_user';

    const body = await request.json();
    const {
      ipoSymbol,
      companyName,
      panId,
      panNumber,
      holderName,
      relationship,
      category,
      lots,
      shares,
      bidPrice,
      blockedAmount,
    } = body;

    if (!ipoSymbol || !panId || !lots || !bidPrice) {
      return NextResponse.json(
        { success: false, error: 'Missing required application fields.' },
        { status: 400 }
      );
    }

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

    const newApp: IpoApplication = {
      id: `app_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ipoSymbol: ipoSymbol.toUpperCase(),
      companyName: companyName || ipoSymbol,
      panId,
      panNumber: maskPan(panNumber || 'ABCDE1234F'),
      holderName: holderName || 'Family Member',
      relationship: relationship || 'Self',
      category: category || 'Retail',
      lots: Number(lots),
      shares: Number(shares) || Number(lots) * 14,
      bidPrice: Number(bidPrice),
      blockedAmount: Number(blockedAmount) || Number(shares) * Number(bidPrice),
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
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, allottedShares } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Application ID is required' }, { status: 400 });
    }

    const updated = await DbRepositoryService.updateApplicationStatus(
      id,
      status,
      allottedShares !== undefined ? Number(allottedShares) : undefined
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
    }

    const app = (await DbRepositoryService.getApplications()).find((a) => a.id === id);

    return NextResponse.json({
      success: true,
      data: app,
      message: 'Application status updated successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    applicationsStore = applicationsStore.filter((a) => a.id !== id);

    return NextResponse.json({
      success: true,
      message: 'Application record removed.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
