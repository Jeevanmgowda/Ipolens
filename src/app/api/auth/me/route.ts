import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/security/session';
import { handleRouteError, jsonError } from '@/lib/http';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return jsonError(401, 'Not authenticated');
    return NextResponse.json({ success: true, user });
  } catch (err) {
    return handleRouteError(err, 'auth/me');
  }
}
