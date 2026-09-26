import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error') || url.searchParams.get('error_description');

  if (error || !code) {
    const errorHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Upstox Authorization Failed | IPOLENS</title>
        <style>
          body { background: #0b101b; color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
          .card { background: #131b2e; border: 1px solid #ef444433; border-radius: 16px; padding: 36px; max-width: 580px; width: 100%; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.5); }
          h1 { color: #ef4444; font-size: 22px; margin-top: 0; }
          p { color: #94a3b8; line-height: 1.6; font-size: 14px; }
          pre { background: #1e1b2e; border: 1px solid #3730a3; color: #fca5a5; padding: 14px; border-radius: 8px; font-size: 13px; overflow-x: auto; }
          .btn { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 500; font-size: 14px; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>❌ Authorization Failed</h1>
          <p>Upstox returned an error during the authentication flow:</p>
          <pre>${error || 'Missing authorization code in callback parameters.'}</pre>
          <a href="/api/auth/upstox" class="btn">Try Again</a>
          <a href="/" class="btn" style="background: #334155; margin-left: 8px;">Back to Dashboard</a>
        </div>
      </body>
      </html>
    `;
    return new NextResponse(errorHtml, {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const clientId = process.env.UPSTOX_CLIENT_ID || '';
  const clientSecret = process.env.UPSTOX_CLIENT_SECRET || '';
  const redirectUri = `${url.origin}/api/auth/callback/upstox`;

  try {
    const tokenRes = await fetch('https://api.upstox.com/v2/login/authorization/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      throw new Error(`Upstox Token API returned HTTP ${tokenRes.status}: ${errBody}`);
    }

    const data = await tokenRes.json();
    const accessToken = data.access_token;
    const userName = data.user_name || data.user_id || 'Upstox Trader';
    const userId = data.user_id || 'N/A';

    // Auto-update .env.local if running in local environment
    let envSaved = false;
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath) && accessToken) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (envContent.includes('UPSTOX_ACCESS_TOKEN=')) {
          envContent = envContent.replace(
            /UPSTOX_ACCESS_TOKEN=.*/,
            `UPSTOX_ACCESS_TOKEN=${accessToken}`
          );
        } else {
          envContent += `\nUPSTOX_ACCESS_TOKEN=${accessToken}\n`;
        }

        // Toggle USE_MOCK_MARKET_DATA to false if present
        if (envContent.includes('USE_MOCK_MARKET_DATA=true')) {
          envContent = envContent.replace(
            'USE_MOCK_MARKET_DATA=true',
            'USE_MOCK_MARKET_DATA=false'
          );
        }

        fs.writeFileSync(envPath, envContent, 'utf8');
        envSaved = true;
      }
    } catch (e) {
      console.error('Could not auto-write to .env.local:', e);
    }

    const successHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Upstox Connected | IPOLENS</title>
        <style>
          body { background: #0b101b; color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
          .card { background: #131b2e; border: 1px solid #10b98133; border-radius: 16px; padding: 36px; max-width: 640px; width: 100%; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.5); }
          .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
          .pulse { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981; }
          h1 { color: #f8fafc; font-size: 24px; margin-top: 0; }
          p { color: #94a3b8; line-height: 1.6; font-size: 14px; margin-bottom: 20px; }
          .meta-box { background: #090d16; border: 1px solid #1e293b; border-radius: 10px; padding: 16px; margin-bottom: 20px; }
          .meta-row { display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #1e293b; }
          .meta-row:last-child { border-bottom: none; }
          .meta-label { color: #64748b; }
          .meta-val { color: #f8fafc; font-weight: 500; font-family: monospace; }
          .token-box { background: #090d16; border: 1px dashed #334155; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 11px; word-break: break-all; color: #a5f3fc; max-height: 80px; overflow-y: auto; margin-bottom: 16px; }
          .btn-group { display: flex; gap: 12px; margin-top: 24px; flex-wrap: wrap; }
          .btn { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 22px; border-radius: 8px; font-weight: 500; font-size: 14px; border: none; cursor: pointer; }
          .btn:hover { background: #1d4ed8; }
          .btn-secondary { background: #1e293b; color: #cbd5e1; }
          .btn-secondary:hover { background: #334155; }
          .note { font-size: 12px; color: #64748b; margin-top: 18px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge"><span class="pulse"></span> UPSTOX V3 CONNECTED</div>
          <h1>Broker Feed Authorized!</h1>
          <p>IPOLENS is now successfully linked to your Upstox account. Real-time market data quotes, candlestick telemetry, and order books are active.</p>

          <div class="meta-box">
            <div class="meta-row">
              <span class="meta-label">User / Account:</span>
              <span class="meta-val">${userName} (${userId})</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Auto-Updated .env.local:</span>
              <span class="meta-val" style="color: ${envSaved ? '#34d399' : '#f59e0b'};">${envSaved ? '✅ Yes (Ready to Stream)' : '⚠️ Copy Manually Below'}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Token Validity:</span>
              <span class="meta-val">1 Trading Day (SEBI Standard)</span>
            </div>
          </div>

          <label style="font-size: 12px; color: #94a3b8; font-weight: 500; display: block; margin-bottom: 6px;">Generated Access Token:</label>
          <div class="token-box" id="tokenBox">${accessToken}</div>

          <div class="btn-group">
            <button class="btn" onclick="copyToken()">📋 Copy Token</button>
            <a href="/" class="btn" style="background: #10b981;">🚀 Go to Live IPO Radar</a>
          </div>

          <p class="note">
            ℹ️ <strong>Note on Indian Broker APIs:</strong> Under SEBI compliance guidelines, Upstox access tokens expire after 24 hours (daily around 3:30 AM IST). You can visit <code>http://localhost:3000/api/auth/upstox</code> anytime each morning to quickly refresh your daily token in 1 click!
          </p>
        </div>

        <script>
          function copyToken() {
            const token = document.getElementById('tokenBox').innerText;
            navigator.clipboard.writeText(token).then(() => {
              alert('Copied Upstox Access Token to clipboard!');
            });
          }
        </script>
      </body>
      </html>
    `;

    return new NextResponse(successHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err: any) {
    const errorHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Token Exchange Failed | IPOLENS</title>
        <style>
          body { background: #0b101b; color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
          .card { background: #131b2e; border: 1px solid #ef444433; border-radius: 16px; padding: 36px; max-width: 580px; width: 100%; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.5); }
          h1 { color: #ef4444; font-size: 22px; margin-top: 0; }
          p { color: #94a3b8; line-height: 1.6; font-size: 14px; }
          pre { background: #1e1b2e; border: 1px solid #3730a3; color: #fca5a5; padding: 14px; border-radius: 8px; font-size: 13px; overflow-x: auto; }
          .btn { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 500; font-size: 14px; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>❌ Token Exchange Failed</h1>
          <p>Failed to exchange authorization code with Upstox server:</p>
          <pre>${err.message}</pre>
          <a href="/api/auth/upstox" class="btn">Try Again</a>
          <a href="/" class="btn" style="background: #334155; margin-left: 8px;">Back to Dashboard</a>
        </div>
      </body>
      </html>
    `;

    return new NextResponse(errorHtml, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
