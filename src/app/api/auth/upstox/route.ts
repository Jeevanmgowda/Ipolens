import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const clientId = process.env.UPSTOX_CLIENT_ID;
  const url = new URL(req.url);
  const redirectUri = `${url.origin}/api/auth/callback/upstox`;

  if (!clientId || clientId.trim() === '' || clientId.includes('your_')) {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Upstox Setup Required | IPOLENS</title>
        <style>
          body { background: #0b101b; color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
          .card { background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 36px; max-width: 580px; width: 100%; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.5); }
          h1 { color: #f59e0b; font-size: 22px; margin-top: 0; display: flex; align-items: center; gap: 10px; }
          p { color: #94a3b8; line-height: 1.6; font-size: 14px; }
          code { background: #1e293b; color: #38bdf8; padding: 2px 6px; border-radius: 6px; font-size: 13px; font-family: monospace; }
          pre { background: #090d16; border: 1px solid #1e293b; color: #a5f3fc; padding: 14px; border-radius: 8px; font-size: 13px; overflow-x: auto; }
          .btn { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 500; font-size: 14px; margin-top: 16px; }
          .btn:hover { background: #1d4ed8; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>⚠️ UPSTOX_CLIENT_ID Missing</h1>
          <p>To connect live Upstox V3 Market Data to IPOLENS, please configure your Upstox App credentials in <code>.env.local</code> first:</p>
          <pre>UPSTOX_CLIENT_ID=your_api_key\nUPSTOX_CLIENT_SECRET=your_api_secret</pre>
          <p>Where to find them:</p>
          <ol style="color: #94a3b8; font-size: 14px; line-height: 1.8; padding-left: 20px;">
            <li>Go to <a href="https://developer.upstox.com/" target="_blank" style="color: #38bdf8;">developer.upstox.com</a></li>
            <li>Create an App with Redirect URL: <code>${redirectUri}</code></li>
            <li>Copy your <strong>API Key</strong> and <strong>API Secret</strong> into <code>.env.local</code></li>
            <li>Refresh this page to proceed with login!</li>
          </ol>
          <a href="/" class="btn">← Back to IPOLENS Dashboard</a>
        </div>
      </body>
      </html>
    `;
    return new NextResponse(html, {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Construct Upstox OAuth authorization dialog URL
  const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return NextResponse.redirect(authUrl);
}
