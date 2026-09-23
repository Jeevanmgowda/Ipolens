import { NextResponse } from 'next/server';
import { registeredUsersStore } from '@/services/authStore';

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const tokenMatch = cookieHeader.match(/ipolens_token=([^;]+)/);

    if (!tokenMatch) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const token = tokenMatch[1];
    const userIdMatch = token.match(/^jwt_session_(usr_[a-zA-Z0-9_]+)/);

    if (!userIdMatch) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }

    const userId = userIdMatch[1];
    const user = registeredUsersStore.find((u) => u.id === userId);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const { passwordHash: _, ...safeUser } = user;
    return NextResponse.json({
      success: true,
      user: safeUser,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
