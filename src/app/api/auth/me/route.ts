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

    // Check legacy token if present
    const cookieHeader = request.headers.get('cookie') || '';
    const tokenMatch = cookieHeader.match(/ipolens_token=([^;]+)/);
    if (tokenMatch) {
      const token = tokenMatch[1];
      const userIdMatch = token.match(/^jwt_session_(usr_[a-zA-Z0-9_]+)/);
      if (userIdMatch) {
        const userId = userIdMatch[1];
        const legacyUser = registeredUsersStore.find((u) => u.id === userId);
        if (legacyUser) {
          const { passwordHash: _, passwordSalt: __, ...safeUser } = legacyUser as any;
          return NextResponse.json({
            success: true,
            user: safeUser,
          });
        }
      }
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
