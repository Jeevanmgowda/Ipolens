import { NextResponse } from 'next/server';
import { RegistrarScannerService } from '@/lib/services/registrar-scanner.service';
import { getUserPansStore } from '@/app/api/pans/route';
import { FamilyPanProfile } from '@/types/pan';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      symbol = 'NSE',
      companyName,
      price,
      lotSize,
      pans: clientPans,
      autoSyncDatabase = true,
    } = body;

    // 1. Resolve family PAN profiles
    let profiles: FamilyPanProfile[] = [];
    if (Array.isArray(clientPans) && clientPans.length > 0) {
      profiles = clientPans;
    } else {
      profiles = getUserPansStore();
    }

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
        error: error.message || 'Failed to execute multi-PAN allotment scan.',
      },
      { status: 500 }
    );
  }
}
