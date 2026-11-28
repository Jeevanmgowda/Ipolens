import { NextResponse } from 'next/server';
import { FamilyPanProfile } from '@/types/pan';
import crypto from 'crypto';
import { maskPan } from '@/services/duplicateEnforcer';
import { PanProfileCreateSchema, firstIssue } from '@/lib/security/schemas';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/security/session';
import { sanitizeString } from '@/lib/security/sanitize';
import { publicErrorMessage } from '@/lib/security/apiError';

// In-memory store for server-side persistence (clean slate, zero mock dummy data)
let userPansStore: FamilyPanProfile[] = [];

export function getUserPansStore(): FamilyPanProfile[] {
  return userPansStore;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();
  const userId = user.id;

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
    if (!user) return unauthorizedResponse();
    const userId = user.id;

    const parsed = PanProfileCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 });
    }
    const { name, relationship, pan: cleanPan, broker, dematId, bankUpi } = parsed.data;

    // Exact duplicate check against the caller's own PANs (keyed hash / decryption),
    // instead of the old masked-prefix comparison that could miss real duplicates
    // and flag different PANs.
    if (await DbRepositoryService.userOwnsFamilyPan(userId, cleanPan)) {
      return NextResponse.json(
        { success: false, error: 'This PAN is already registered in your family profiles.' },
        { status: 400 }
      );
    }

    const newProfile: FamilyPanProfile = {
      id: `pan_${crypto.randomUUID()}`,
      name: sanitizeString(name).slice(0, 100),
      relationship,
      pan: cleanPan,
      broker: sanitizeString(broker || 'Zerodha').slice(0, 50),
      dematId: dematId ? sanitizeString(dematId).slice(0, 30) : undefined,
      bankUpi: bankUpi ? sanitizeString(bankUpi).slice(0, 80) : undefined,
      createdAt: new Date().toISOString(),
    };

    const saved = await DbRepositoryService.savePan(newProfile, userId, cleanPan);

    return NextResponse.json({
      success: true,
      data: saved,
      message: `Successfully registered encrypted PAN profile for ${saved.name} (${maskPan(cleanPan)}).`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: publicErrorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();
    const userId = user.id;

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
    return NextResponse.json({ success: false, error: publicErrorMessage(err) }, { status: 500 });
  }
}
