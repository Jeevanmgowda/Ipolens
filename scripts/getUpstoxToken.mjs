#!/usr/bin/env node

/**
 * IPOLENS — Upstox Access Token Helper & Headless Refresher
 * 
 * Features:
 *   1. Automated Headless Mode (Zero human interaction):
 *      When UPSTOX_MOBILE, UPSTOX_PIN, and UPSTOX_TOTP_KEY are present:
 *      - Computes standard RFC 6238 HMAC-SHA1 6-digit TOTP in milliseconds.
 *      - If Puppeteer Chrome is installed, runs an invisible background
 *        session to authorize and capture the token in <5 seconds.
 * 
 *   2. Instant 1-Click Browser Interceptor Mode:
 *      - Automatically opens the Upstox authorization dialog in your default browser.
 *      - Listens on the redirect port (3000) to automatically catch the `?code=` callback
 *        in real time (<200ms), exchanges it, and updates .env.local without copying/pasting.
 * 
 *   3. Interactive CLI Fallback:
 *      - Allows pasting the code or redirect URL directly if ports are busy.
 * 
 * Usage:
 *   npm run upstox:token
 *   or: node scripts/getUpstoxToken.mjs
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import crypto from 'crypto';
import http from 'http';
import { exec } from 'child_process';

const envPath = path.resolve(process.cwd(), '.env.local');

let clientId = process.env.UPSTOX_CLIENT_ID || process.env.UPSTOX_API_KEY || '';
let clientSecret = process.env.UPSTOX_CLIENT_SECRET || process.env.UPSTOX_API_SECRET || '';
let redirectUri = process.env.UPSTOX_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/upstox';
let userMobile = process.env.UPSTOX_MOBILE || '';
let userPin = process.env.UPSTOX_PIN || '';
let totpKey = process.env.UPSTOX_TOTP_KEY || process.env.UPSTOX_TOTP_SECRET || '';

// Load variables from .env.local if present
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  const idMatch = content.match(/UPSTOX_(?:CLIENT_ID|API_KEY)=([^\r\n]+)/);
  const secMatch = content.match(/UPSTOX_(?:CLIENT_SECRET|API_SECRET)=([^\r\n]+)/);
  const uriMatch = content.match(/UPSTOX_REDIRECT_URI=([^\r\n]+)/);
  const mobMatch = content.match(/UPSTOX_MOBILE=([^\r\n]+)/);
  const pinMatch = content.match(/UPSTOX_PIN=([^\r\n]+)/);
  const totpMatch = content.match(/UPSTOX_(?:TOTP_KEY|TOTP_SECRET)=([^\r\n]+)/);

  if (idMatch && idMatch[1] && !idMatch[1].startsWith('your_')) clientId = idMatch[1].replace(/["']/g, '').trim();
  if (secMatch && secMatch[1] && !secMatch[1].startsWith('your_')) clientSecret = secMatch[1].replace(/["']/g, '').trim();
  if (uriMatch && uriMatch[1] && !uriMatch[1].startsWith('your_')) redirectUri = uriMatch[1].replace(/["']/g, '').trim();
  if (mobMatch && mobMatch[1] && !mobMatch[1].startsWith('your_')) userMobile = mobMatch[1].replace(/["']/g, '').trim();
  if (pinMatch && pinMatch[1] && !pinMatch[1].startsWith('your_')) userPin = pinMatch[1].replace(/["']/g, '').trim();
  if (totpMatch && totpMatch[1] && !totpMatch[1].startsWith('your_')) totpKey = totpMatch[1].replace(/["']/g, '').trim();
}

console.log('\n================================================================');
console.log('            IPOLENS — Upstox Access Token Refresher              ');
console.log('================================================================\n');

if (!clientId || !clientSecret) {
  console.log('⚠️  Please add UPSTOX_CLIENT_ID and UPSTOX_CLIENT_SECRET to .env.local first:');
  console.log('   UPSTOX_CLIENT_ID=your_api_key_here');
  console.log('   UPSTOX_CLIENT_SECRET=your_api_secret_here\n');
  console.log('Get them from https://developer.upstox.com/ (Apps -> Create App)');
  console.log('Set Redirect URL in Upstox App to: ' + redirectUri + '\n');
  process.exit(1);
}

/**
 * Generates an RFC 6238 standard TOTP (6-digit, 30-sec time step) from Base32 secret
 */
function generateTotp(base32Secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of base32Secret.toUpperCase().replace(/[\s=]/g, '')) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  const key = Buffer.from(bytes);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000;

  return code.toString().padStart(6, '0');
}

/**
 * Persists updated token into .env.local
 */
function saveTokenToEnv(token, userIdentifier = '') {
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, `UPSTOX_ACCESS_TOKEN=${token}\n`, 'utf8');
    return;
  }

  let envContent = fs.readFileSync(envPath, 'utf8');
  if (envContent.includes('UPSTOX_ACCESS_TOKEN=')) {
    envContent = envContent.replace(/UPSTOX_ACCESS_TOKEN=.*/, `UPSTOX_ACCESS_TOKEN=${token}`);
  } else {
    envContent += `\nUPSTOX_ACCESS_TOKEN=${token}\n`;
  }

  if (envContent.includes('USE_MOCK_MARKET_DATA=true')) {
    envContent = envContent.replace('USE_MOCK_MARKET_DATA=true', 'USE_MOCK_MARKET_DATA=false');
  }

  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log(`\n🎉 Success! Updated .env.local with fresh access token.`);
  if (userIdentifier) console.log(`   Connected Account: ${userIdentifier}`);
  console.log(`   USE_MOCK_MARKET_DATA set to false for live market streaming.\n`);
}

/**
 * Exchanges authorization code for daily access token
 */
async function exchangeCodeForToken(code) {
  console.log('\nExchanging authorization code for daily access token...');
  const res = await fetch('https://api.upstox.com/v2/login/authorization/token', {
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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upstox API Error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const token = data.access_token;
  saveTokenToEnv(token, data.user_name || data.user_id);
  return token;
}

/**
 * Mode 1: Automated Headless Refresh using Puppeteer (Zero Human Interaction)
 */
async function runHeadlessPuppeteer() {
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch {
    return false;
  }

  // Pre-check if Chrome executable actually exists on disk so we never hang 30s
  try {
    const execPath = puppeteer.executablePath();
    if (!execPath || !fs.existsSync(execPath)) {
      console.log('ℹ️  Puppeteer Chrome browser binary is not yet downloaded.');
      console.log('👉 To enable 100% background headless automation, run:');
      console.log('   npx puppeteer browsers install chrome\n');
      return false;
    }
  } catch {
    console.log('ℹ️  Puppeteer Chrome browser binary is not yet downloaded.');
    console.log('👉 To enable 100% background headless automation, run:');
    console.log('   npx puppeteer browsers install chrome\n');
    return false;
  }

  console.log('⚡ Zero-Human-Interaction Mode: Detected mobile, PIN, and TOTP key.');
  console.log('🤖 Launching invisible headless browser worker...');

  const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      timeout: 10000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    console.log('   Navigating to Upstox authorization portal...');
    await page.goto(authUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Step 1: Input Mobile Number
    console.log('   Entering registered mobile number...');
    const mobileSelector = 'input[type="tel"], input#mobileNum, input[name="mobileNo"], input[placeholder*="mobile" i]';
    await page.waitForSelector(mobileSelector, { timeout: 10000 });
    await page.type(mobileSelector, userMobile, { delay: 40 });
    await page.keyboard.press('Enter');

    // Step 2: Input TOTP
    console.log('   Computing RFC 6238 TOTP...');
    const totpCode = generateTotp(totpKey);
    console.log(`   Generated TOTP: ${totpCode}`);

    const otpSelector = 'input[autocomplete="one-time-code"], input#otpNum, input[name="otp"], input[placeholder*="otp" i]';
    await page.waitForSelector(otpSelector, { timeout: 10000 });
    await page.type(otpSelector, totpCode, { delay: 40 });
    await page.keyboard.press('Enter');

    // Step 3: Input PIN
    console.log('   Entering account PIN...');
    const pinSelector = 'input[type="password"], input#pinCode, input[name="pin"], input[placeholder*="pin" i]';
    await page.waitForSelector(pinSelector, { timeout: 10000 });
    await page.type(pinSelector, userPin, { delay: 40 });
    await page.keyboard.press('Enter');

    // Step 4: Intercept Redirect Code
    console.log('   Awaiting OAuth code redirection...');
    let authCode = null;

    for (let i = 0; i < 20; i++) {
      const currentUrl = page.url();
      if (currentUrl.includes('code=')) {
        const parsed = new URL(currentUrl);
        authCode = parsed.searchParams.get('code');
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    await browser.close();

    if (authCode) {
      console.log(`   Captured OAuth Authorization Code!`);
      await exchangeCodeForToken(authCode);
      console.log('✅ Zero-Interaction Refresh Complete! Market feed is ready.\n');
      process.exit(0);
    } else {
      console.warn('⚠️ Could not automatically capture authorization code from page redirection.');
      return false;
    }
  } catch (err) {
    if (browser) {
      try { await browser.close(); } catch {}
    }
    console.warn(`⚠️ Headless browser automation error: ${err.message}`);
    return false;
  }
}

/**
 * Mode 2: Semi-Automated Local Interceptor Server
 * Listens on the redirect port so clicking the auth link in browser completes
 * the token exchange in <200ms without copying and pasting codes.
 */
function startLocalCallbackServer(onCodeReceived) {
  try {
    const parsedRedirect = new URL(redirectUri);
    const port = parseInt(parsedRedirect.port || '3000', 10);
    const pathName = parsedRedirect.pathname;

    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url, `http://${req.headers.host}`);
        const code = reqUrl.searchParams.get('code');
        
        // Match either exact pathname or any upstox callback request with code
        if (code && (reqUrl.pathname === pathName || reqUrl.pathname.includes('callback') || reqUrl.pathname.includes('upstox'))) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Upstox Connected | IPOLENS</title>
                <style>
                  body { background: #0b101b; color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
                  .card { background: #131b2e; border: 1px solid #10b981; border-radius: 16px; padding: 36px; max-width: 480px; text-align: center; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.5); }
                  h2 { color: #34d399; margin-top: 0; }
                  p { color: #94a3b8; font-size: 14px; line-height: 1.5; }
                </style>
              </head>
              <body>
                <div class="card">
                  <h2>✅ Upstox Token Refreshed!</h2>
                  <p>IPOLENS <code>.env.local</code> has been updated with your fresh access token.</p>
                  <p style="color: #64748b; font-size: 12px;">You can now close this browser tab.</p>
                </div>
              </body>
            </html>
          `);
          server.close();
          await onCodeReceived(code);
        }
      } catch (e) {
        // Ignore parsing errors for random probes
      }
    });

    server.on('error', () => {
      // Port in use (e.g. Next.js server already running), fall back cleanly
    });

    server.listen(port);
  } catch (e) {
    // URL parse error or port binding error
  }
}

/**
 * Mode 3: Interactive Prompt Mode (with Auto-Browser Launch)
 */
function runInteractiveMode() {
  const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  console.log('1. Opening Upstox authorization in your default browser...\n');
  console.log(`\x1b[36m${authUrl}\x1b[0m\n`);
  console.log('2. Log in with your mobile number, OTP, and 6-digit PIN.');
  console.log('3. Upstox will redirect back to:');
  console.log(`   ${redirectUri}?code=YOUR_CODE_HERE\n`);

  // Auto-launch the URL in default browser so user doesn't have to copy-paste URLs
  try {
    const startCmd = process.platform === 'win32'
      ? `start "" "${authUrl}"`
      : process.platform === 'darwin'
      ? `open "${authUrl}"`
      : `xdg-open "${authUrl}"`;
    exec(startCmd, () => {});
  } catch (e) {}

  let codeHandled = false;

  // Start background callback listener
  startLocalCallbackServer(async (code) => {
    if (codeHandled) return;
    codeHandled = true;
    try {
      await exchangeCodeForToken(code);
      process.exit(0);
    } catch (err) {
      console.error('❌ Request failed:', err.message);
      process.exit(1);
    }
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Paste authorization code or redirect URL (if not auto-captured): ', async (input) => {
    rl.close();
    if (codeHandled) return;

    let code = input.trim();
    if (code.includes('code=')) {
      try {
        const parsed = new URL(code.startsWith('http') ? code : `http://dummy.com/${code}`);
        code = parsed.searchParams.get('code') || code;
      } catch {
        const match = code.match(/code=([^&]+)/);
        if (match) code = match[1];
      }
    }

    if (!code) {
      console.error('❌ Error: No authorization code provided.');
      process.exit(1);
    }

    codeHandled = true;
    try {
      await exchangeCodeForToken(code);
      process.exit(0);
    } catch (err) {
      console.error('❌ Request failed:', err.message);
      if (err.message.includes('UDAPI100057')) {
        console.log('\n💡 Upstox Error UDAPI100057 (Invalid Auth Code) happens because:');
        console.log('   - Upstox codes expire after ~60 seconds, or have already been exchanged.');
        console.log('👉 Simply run "npm run upstox:token" again to get a fresh code in seconds!\n');
      }
      process.exit(1);
    }
  });
}

// Main execution flow
async function main() {
  if (userMobile && userPin && totpKey) {
    const success = await runHeadlessPuppeteer();
    if (!success) {
      runInteractiveMode();
    }
  } else {
    runInteractiveMode();
  }
}

main();
