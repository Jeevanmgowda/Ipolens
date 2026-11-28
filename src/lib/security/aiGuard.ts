import { NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/security/session';
import { applyRateLimitHeaders, checkRateLimitDistributed } from '@/lib/security/rateLimiter';
import type { User } from '@/types/auth';

/**
 * Gate for routes that call a paid AI model or write to the DRHP index
 * (docs/security/AUDIT_2026-11-27.md, H3/H6): a signed-in user plus a per-user
 * hourly quota. Returns the user, or a ready-to-return 401/429 response.
 */
export async function requireAiAccess(request: Request): Promise<{ user: User } | { response: Response }> {
  const user = await getAuthenticatedUser(request);
  if (!user) return { response: unauthorizedResponse() };

  const quota = await checkRateLimitDistributed(`user:${user.id}`, 'ai');
  if (!quota.allowed) {
    const response = NextResponse.json(
      { success: false, error: `AI analysis limit reached. Please try again in ${Math.ceil(quota.resetSeconds / 60)} minutes.` },
      { status: 429 }
    );
    applyRateLimitHeaders(response.headers, quota);
    return { response };
  }
  return { user };
}
