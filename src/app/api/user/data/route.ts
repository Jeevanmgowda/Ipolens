import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/security/session';
import { DbRepositoryService } from '@/lib/services/db-repository.service';

/**
 * DPDP Compliance: Right to Erasure / Data Purge Endpoint
 * Permanently removes user's stored PANs, bidding applications, and portfolio items.
 */
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const userId = user ? user.id : 'default_user';

    await DbRepositoryService.purgeUserData(userId);

    return NextResponse.json({
      success: true,
      message: 'All personal data, PAN profiles, and application ledgers have been purged in compliance with DPDP guidelines.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
