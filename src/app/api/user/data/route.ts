import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/security/session';
import { handleRouteError } from '@/lib/http';
import { DbRepositoryService } from '@/lib/services/db-repository.service';

/**
 * DPDP Compliance: Right to Erasure / Data Purge Endpoint
 * Permanently removes user's stored PANs, bidding applications, and portfolio items.
 */
export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    const userId = user.id;

    await DbRepositoryService.purgeUserData(userId);

    return NextResponse.json({
      success: true,
      message: 'All personal data, PAN profiles, and application ledgers have been purged in compliance with DPDP guidelines.',
    });
  } catch (err) {
    return handleRouteError(err, 'src/app/api/user/data/route.ts');
  }
}
