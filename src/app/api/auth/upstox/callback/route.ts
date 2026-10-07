import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Alternative callback alias for Upstox OAuth redirection.
 * Forwards code and state parameters to the primary callback processor.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const targetUrl = new URL(`${url.origin}/api/auth/callback/upstox`);
  url.searchParams.forEach((val, key) => {
    targetUrl.searchParams.set(key, val);
  });
  return NextResponse.redirect(targetUrl.toString());
}
