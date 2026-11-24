import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/security/session';
import { registeredUsersStore } from '@/services/authStore';

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
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
