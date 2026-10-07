import { NextResponse } from 'next/server';
import { extractTokenFromRequest, destroySession } from '@/lib/security/session';

export async function POST(request: Request) {
  const token = extractTokenFromRequest(request);
  if (token) {
    await destroySession(token);
  }

  const response = NextResponse.json({
    success: true,
    message: 'Signed out successfully',
  });

  response.cookies.delete('ipolens_session');
  response.cookies.delete('ipolens_token');

  return response;
}
