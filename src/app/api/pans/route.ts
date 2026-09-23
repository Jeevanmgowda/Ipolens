import { NextResponse } from 'next/server';
import { FamilyPanProfile } from '@/types/pan';
import { isValidPan, maskPan } from '@/services/duplicateEnforcer';
import { DbRepositoryService } from '@/lib/services/db-repository.service';

// In-memory store for server-side persistence (clean slate, zero mock dummy data)
let userPansStore: FamilyPanProfile[] = [];

export function getUserPansStore(): FamilyPanProfile[] {
  return userPansStore;
}

export async function GET() {
  const data = await DbRepositoryService.getPans();
  return NextResponse.json({
    success: true,
    data,
    databaseActive: DbRepositoryService.isDatabaseActive(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, relationship, pan, broker, dematId, bankUpi } = body;

    if (!name || !pan || !relationship) {
      return NextResponse.json(
        { success: false, error: 'Name, PAN number, and Relationship are required.' },
        { status: 400 }
      );
    }

    if (!isValidPan(pan)) {
      return NextResponse.json(
        { success: false, error: 'Invalid PAN format. PAN must be 10 characters (e.g. ABCDE1234F).' },
        { status: 400 }
      );
    }

    // Check if PAN is already added in family profiles
    const cleanPan = pan.trim().toUpperCase();
    const allPans = await DbRepositoryService.getPans();
    const existing = allPans.find((p) => p.pan.toUpperCase() === cleanPan);
    if (existing) {
      return NextResponse.json(
        { success: false, error: `This PAN is already registered under profile "${existing.name}".` },
        { status: 400 }
      );
    }

    const newProfile: FamilyPanProfile = {
      id: `pan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      relationship,
      pan: cleanPan,
      broker: broker || 'Zerodha',
      dematId: dematId ? dematId.trim() : undefined,
      bankUpi: bankUpi ? bankUpi.trim() : undefined,
      createdAt: new Date().toISOString(),
    };

    await DbRepositoryService.savePan(newProfile);

    return NextResponse.json({
      success: true,
      data: newProfile,
      message: `Successfully registered PAN profile for ${newProfile.name} (${maskPan(newProfile.pan)}).`,
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

    await DbRepositoryService.deletePan(id);

    return NextResponse.json({
      success: true,
      message: 'PAN profile deleted successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
