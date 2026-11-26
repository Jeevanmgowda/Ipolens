import { NextResponse } from 'next/server';
<<<<<<< HEAD
import { isDemoLoginEnabled, registeredUsersStore } from '@/services/authStore';
=======
import { isDemoLoginEnabled, registeredUsersStore } from '@/lib/services/authStore';
>>>>>>> origin/main
import { createSession } from '@/lib/security/session';

export const dynamic = 'force-dynamic';

const DEMO_ACCOUNT_IDS: Record<string, string> = {
  institutional: 'usr_inst_01',
  retail: 'usr_ret_02',
};

/**
 * One-click demo login. Issues a real server session for a seeded demo account so
 * per-user API routes work. Disabled in production unless ENABLE_DEMO_LOGIN=true.
 */
export async function POST(request: Request) {
  if (!isDemoLoginEnabled()) {
    return NextResponse.json({ success: false, error: 'Demo login is disabled.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = DEMO_ACCOUNT_IDS[body?.type as string];
  const record = userId ? registeredUsersStore.find((u) => u.id === userId) : undefined;
  if (!record) {
    return NextResponse.json({ success: false, error: 'Unknown demo account.' }, { status: 400 });
  }

  const { token, expiresAt } = await createSession(record.id, false);
  const user: Partial<typeof record> = { ...record };
  delete user.passwordHash;
  delete user.passwordSalt;

  const response = NextResponse.json({ success: true, user, message: 'Signed in to demo account' });
  response.cookies.set('ipolens_session', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
  });
  return response;
}
