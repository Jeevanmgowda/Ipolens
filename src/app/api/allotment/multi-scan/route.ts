import { NextResponse } from 'next/server';
import { RegistrarScannerService } from '@/lib/services/registrar-scanner.service';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { requireUserOr401 } from '@/lib/security/guards';
import { FamilyPanProfile } from '@/types/pan';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const auth = await requireUserOr401(request);
    if (!auth.user) return auth.response;
    const body = await request.json();
    const {
      symbol = 'NSE',
      companyName,
      price,
      lotSize,
      autoSyncDatabase = true,
    } = body;

    // 1. Resolve family PAN profiles
    // Only the caller's own PAN profiles, loaded server-side. Client-supplied PAN lists are ignored.
    const profiles: FamilyPanProfile[] = await DbRepositoryService.getPans(auth.user.id);

    if (profiles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No family PAN profiles registered. Please add family PANs in the Family PAN Manager first.',
      }, { status: 400 });
    }

    // 2. Perform concurrent multi-PAN registrar scan
    const summary = await RegistrarScannerService.scanAllFamilyPans({
      symbol,
      companyName: companyName || symbol,
      price: price ? Number(price) : undefined,
      lotSize: lotSize ? Number(lotSize) : undefined,
      pans: profiles,
      autoSyncDatabase: Boolean(autoSyncDatabase),
    });

    return NextResponse.json({
      success: true,
      data: summary,
      message: `Scanned ${summary.totalPansScanned} family PANs at ${summary.registrarName}. ${summary.allottedCount} allotted (${summary.totalSharesAllotted} shares).`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in /api/allotment/multi-scan:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute multi-PAN allotment scan.',
      },
      { status: 500 }
    );
  }
}
