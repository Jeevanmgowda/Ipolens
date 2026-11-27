import { NextResponse } from 'next/server';
import { z } from 'zod';
import { FamilyPanProfile } from '@/types/pan';
import { isValidPan, maskPan, normalizePan } from '@/lib/security/panEncryption';
import { DbRepositoryService } from '@/lib/services/db-repository.service';
import { requireUser } from '@/lib/security/session';
import { sanitizeString } from '@/lib/security/sanitize';
import { handleRouteError, jsonError } from '@/lib/http';

const CreatePan = z.object({
  name: z.string().trim().min(1).max(100),
  relationship: z.enum(['Self', 'Spouse', 'Parent', 'Child', 'HUF', 'Other']),
  pan: z.string().trim().length(10),
  broker: z.string().trim().max(50).optional(),
  dematId: z.string().trim().max(30).optional(),
  bankUpi: z.string().trim().max(80).optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return NextResponse.json({ success: true, data: await DbRepositoryService.getPans(user.id) });
  } catch (err) {
    return handleRouteError(err, 'pans:GET');
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = CreatePan.parse(await request.json());
    const cleanPan = normalizePan(body.pan);
    if (!isValidPan(cleanPan)) {
      return jsonError(400, 'Invalid PAN format. PAN must be 10 characters (e.g. ABCDE1234F).');
    }

    const existing = await DbRepositoryService.hasPan(user.id, cleanPan);
    if (existing) return jsonError(409, `This PAN is already registered under profile "${existing.name}".`);

    const profile: FamilyPanProfile = {
      id: `pan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: sanitizeString(body.name),
      relationship: body.relationship,
      pan: cleanPan,
      broker: sanitizeString(body.broker || 'Other'),
      dematId: body.dematId ? sanitizeString(body.dematId) : undefined,
      bankUpi: body.bankUpi ? sanitizeString(body.bankUpi) : undefined,
      createdAt: new Date().toISOString(),
    };
    const saved = await DbRepositoryService.savePan(profile, user.id, cleanPan);
    return NextResponse.json({
      success: true,
      data: saved,
      message: `Saved encrypted PAN profile for ${saved.name} (${maskPan(cleanPan)}).`,
    });
  } catch (err) {
    return handleRouteError(err, 'pans:POST');
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return jsonError(400, 'ID is required');
    const deleted = await DbRepositoryService.deletePan(id, user.id);
    if (!deleted) return jsonError(404, 'PAN profile not found.');
    return NextResponse.json({ success: true, message: 'PAN profile deleted.' });
  } catch (err) {
    return handleRouteError(err, 'pans:DELETE');
  }
}
