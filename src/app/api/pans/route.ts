import { NextResponse } from 'next/server';
import { FamilyPanProfile } from '@/types/pan';
import { isValidPan, maskPan } from '@/services/duplicateEnforcer';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { getAuthenticatedUser } from '@/lib/security/session';

// In-memory store for server-side persistence (clean slate, zero mock dummy data)
let userPansStore: FamilyPanProfile[] = [];

export function getUserPansStore(): FamilyPanProfile[] {
  return userPansStore;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  const userId = user ? user.id : 'default_user';

  const data = await DbRepositoryService.getPans(userId);
  return NextResponse.json({
    success: true,
    data,
    userId,
    databaseActive: DbRepositoryService.isDatabaseActive(),
  });
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const userId = user ? user.id : 'default_user';

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

    // Check if PAN is already added in user's family profiles
    const cleanPan = pan.trim().toUpperCase();
    const allPans = await DbRepositoryService.getPans(userId);
    const existing = allPans.find((p) => p.pan.toUpperCase() === cleanPan || p.pan.toUpperCase() === maskPan(cleanPan));
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

    const saved = await DbRepositoryService.savePan(newProfile, userId, cleanPan);

    return NextResponse.json({
      success: true,
      data: saved,
      message: `Successfully registered encrypted PAN profile for ${saved.name} (${maskPan(cleanPan)}).`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const userId = user ? user.id : 'default_user';

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    await DbRepositoryService.deletePan(id, userId);

    return NextResponse.json({
      success: true,
      message: 'PAN profile deleted successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
