import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = process.env.UPSTOX_ACCESS_TOKEN || '';
  const clientId = process.env.UPSTOX_CLIENT_ID || process.env.UPSTOX_API_KEY || '';
  const clientSecret = process.env.UPSTOX_CLIENT_SECRET || process.env.UPSTOX_API_SECRET || '';

  if (!token || token.length < 20 || token.includes('your_')) {
    return NextResponse.json({
      configured: Boolean(clientId && clientSecret),
      hasToken: false,
      valid: false,
      message: clientId ? 'Upstox App configured, but token needs generation.' : 'Upstox Client ID / Secret missing in .env.local',
      authUrl: '/api/auth/upstox',
    });
  }

  try {
    const res = await fetch('https://api.upstox.com/v2/user/profile', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token.trim()}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({
        configured: true,
        hasToken: true,
        valid: false,
        status: res.status,
        error: err.errors?.[0]?.message || 'Upstox token is expired or unauthorized.',
        message: 'Your daily Upstox token has expired (Upstox tokens expire daily). Click to refresh.',
        authUrl: '/api/auth/upstox',
      });
    }

    const data = await res.json();
    return NextResponse.json({
      configured: true,
      hasToken: true,
      valid: true,
      user: data.data?.user_name || data.data?.user_id || 'Upstox Trader',
      userId: data.data?.user_id,
      broker: 'Upstox Developer v2/v3',
      message: 'Active Live Upstox Session connected.',
    });
  } catch (error: any) {
    return NextResponse.json({
      configured: true,
      hasToken: true,
      valid: false,
      error: error.message,
      message: 'Failed to verify Upstox token connection.',
      authUrl: '/api/auth/upstox',
    });
  }
}
