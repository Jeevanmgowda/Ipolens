import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/security/session';
<<<<<<< HEAD
import { registeredUsersStore } from '@/services/authStore';
=======
import { registeredUsersStore } from '@/lib/services/authStore';
>>>>>>> origin/main
import { publicErrorMessage } from '@/lib/security/apiError';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);

    if (user) {
      return NextResponse.json({
        success: true,
        user,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    );
  } catch (err: any) {
    console.error('[API] /api/auth/me:', err);
    return NextResponse.json(
      { success: false, error: publicErrorMessage(err, 'Internal server error') },
      { status: 500 }
    );
  }
}
