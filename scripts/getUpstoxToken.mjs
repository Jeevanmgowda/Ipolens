#!/usr/bin/env node

/**
 * IPOLENS — Upstox Access Token Helper & Headless Refresher
 * 
 * Features:
 *   1. Automated Headless Mode (Zero human interaction):
 *      When UPSTOX_MOBILE, UPSTOX_PIN, and UPSTOX_TOTP_KEY are present:
 *      - Computes standard RFC 6238 HMAC-SHA1 6-digit TOTP in milliseconds.
 *      - Runs an invisible background Puppeteer session to authorize and capture token in <5s.
 * 
 *   2. Instant 1-Click Browser Interceptor Mode:
 *      - Automatically opens the Upstox authorization dialog in your default browser.
 *      - Listens on the redirect port (3000) to automatically catch the `?code=` callback
 *        in real time (<200ms), exchanges it, and updates .env.local without copying/pasting.
 * 
 *   3. Interactive CLI Fallback:
 *      - Allows pasting the code or redirect URL directly if ports are busy.
 * 
 *   4. Programmatic API for `scripts/devWithUpstox.mjs` / `npm run dev`:
 *      - checkTokenValidity(config): inspects JWT expiry instantly (<1ms).
 *      - refreshUpstoxToken(options): runs automated refresh and updates .env.local.
 * 
 * Usage:
 *   npm run upstox:token
 *   or: node scripts/getUpstoxToken.mjs [--if-needed]
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import crypto from 'crypto';
import http from 'http';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const envPath = path.resolve(process.cwd(), '.env.local');

// Helper to strip quotes and comments
export function parseEnvVal(val) {
  if (!val) return '';
  let str = val.trim();
  if (str.startsWith('"')) {
    const end = str.indexOf('"', 1);
    if (end !== -1) str = str.substring(1, end);
  } else if (str.startsWith("'")) {
    const end = str.indexOf("'", 1);
    if (end !== -1) str = str.substring(1, end);
  } else {
    const hash = str.indexOf('#');
    if (hash !== -1) str = str.substring(0, hash).trim();
  }
  return str.replace(/["']/g, '').trim();
}

/**
 * Safely loads environment configuration from .env.local and process.env
 */
export function readEnvConfig(customEnvPath) {
  const targetEnv = customEnvPath || envPath;
  const config = {
    envPath: targetEnv,
    clientId: process.env.UPSTOX_CLIENT_ID || process.env.UPSTOX_API_KEY || '',
    clientSecret: process.env.UPSTOX_CLIENT_SECRET || process.env.UPSTOX_API_SECRET || '',
    redirectUri: process.env.UPSTOX_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/upstox',
    userMobile: process.env.UPSTOX_MOBILE || '',
    userPin: process.env.UPSTOX_PIN || '',
    totpKey: process.env.UPSTOX_TOTP_KEY || process.env.UPSTOX_TOTP_SECRET || '',
    accessToken: process.env.UPSTOX_ACCESS_TOKEN || '',
    useMock: process.env.USE_MOCK_MARKET_DATA === 'true',
  };

  if (fs.existsSync(targetEnv)) {
    const content = fs.readFileSync(targetEnv, 'utf8');
    const getVal = (regex) => {
      const match = content.match(regex);
      return match && match[1] ? parseEnvVal(match[1]) : '';
    };

    const id = getVal(/UPSTOX_(?:CLIENT_ID|API_KEY)=([^\r\n]+)/);
    const sec = getVal(/UPSTOX_(?:CLIENT_SECRET|API_SECRET)=([^\r\n]+)/);
    const uri = getVal(/UPSTOX_REDIRECT_URI=([^\r\n]+)/);
    const mob = getVal(/UPSTOX_MOBILE=([^\r\n]+)/);
    const pin = getVal(/UPSTOX_PIN=([^\r\n]+)/);
    const totp = getVal(/UPSTOX_(?:TOTP_KEY|TOTP_SECRET)=([^\r\n]+)/);
    const token = getVal(/UPSTOX_ACCESS_TOKEN=([^\r\n]+)/);
    const mock = getVal(/USE_MOCK_MARKET_DATA=([^\r\n]+)/);

    if (id && !id.startsWith('your_')) config.clientId = id;
    if (sec && !sec.startsWith('your_')) config.clientSecret = sec;
    if (uri && !uri.startsWith('your_')) config.redirectUri = uri;
    if (mob && !mob.startsWith('your_')) config.userMobile = mob;
    if (pin && !pin.startsWith('your_')) config.userPin = pin;
    if (totp && !totp.startsWith('your_')) config.totpKey = totp;
    if (token && !token.startsWith('your_')) config.accessToken = token;
    if (mock) config.useMock = mock.toLowerCase() === 'true';
  }

  return config;
}

/**
 * Checks if the current UPSTOX_ACCESS_TOKEN is present and valid (<1ms)
 */
export function checkTokenValidity(config) {
  const cfg = config || readEnvConfig();
  const token = (cfg.accessToken || '').trim();

  if (!token || token.length < 20 || token.startsWith('your_')) {
    return { valid: false, reason: 'No access token found in .env.local' };
  }

  // 1. Inspect JWT payload
  const parts = token.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      if (payload.exp) {
        const nowSec = Math.floor(Date.now() / 1000);
        const secLeft = payload.exp - nowSec;
        const expiresAt = new Date(payload.exp * 1000);
        const hoursLeft = Math.max(0, (secLeft / 3600)).toFixed(1);

        if (secLeft > 180) { // Has more than 3 minutes remaining
          return {
            valid: true,
            account: payload.sub || 'Upstox Trader',
            expiresAt,
            hoursLeft,
            secLeft,
            isJwt: true,
          };
        } else {
          return {
            valid: false,
            account: payload.sub || 'Upstox Trader',
            expiresAt,
            hoursLeft: 0,
            secLeft,
            reason: `Token expired at ${expiresAt.toLocaleTimeString()} (${expiresAt.toLocaleDateString()})`,
            isJwt: true,
          };
        }
      }
    } catch {
      // Fall through to non-JWT handling
    }
  }

  // 2. Non-JWT format (or 1-year opaque token)
  return { valid: false, reason: 'Token format not recognized or expired' };
}

/**
 * Fast online verification with Upstox API (supports user profile + 1-year analytics token)
 */
export async function verifyTokenWithUpstox(token) {
  if (!token) return { valid: false };
  try {
    const res = await fetch('https://api.upstox.com/v2/user/profile', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token.trim()}`,
      },
      signal: AbortSignal.timeout(2500),
    });

    if (res.ok) {
      const data = await res.json();
      return { valid: true, account: data.data?.user_name || data.data?.user_id };
    }

    // 1-Year Analytics Tokens return 403 on /user/profile but succeed on market quote
    if (res.status === 403) {
      const qRes = await fetch('https://api.upstox.com/v2/market-quote/quotes?instrument_key=NSE_EQ|INE002A01018', {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token.trim()}`,
        },
        signal: AbortSignal.timeout(2500),
      });
      if (qRes.ok) {
        return { valid: true, account: 'Upstox Analytics Token (1-Year)' };
      }
    }

    return { valid: false, status: res.status };
  } catch {
    return null; // Network timeout or offline
  }
}

/**
 * Generates an RFC 6238 standard TOTP (6-digit, 30-sec time step) from Base32 secret
 */
export function generateTotp(base32Secret) {
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
 * Persists updated token into .env.local and process.env
 */
export function saveTokenToEnv(token, userIdentifier = '', targetEnv = envPath) {
  if (!fs.existsSync(targetEnv)) {
    fs.writeFileSync(targetEnv, `UPSTOX_ACCESS_TOKEN=${token}\n`, 'utf8');
  } else {
    let envContent = fs.readFileSync(targetEnv, 'utf8');
    if (envContent.includes('UPSTOX_ACCESS_TOKEN=')) {
      envContent = envContent.replace(/UPSTOX_ACCESS_TOKEN=.*/, `UPSTOX_ACCESS_TOKEN=${token}`);
    } else {
      envContent += `\nUPSTOX_ACCESS_TOKEN=${token}\n`;
    }

    if (envContent.includes('USE_MOCK_MARKET_DATA=true')) {
      envContent = envContent.replace('USE_MOCK_MARKET_DATA=true', 'USE_MOCK_MARKET_DATA=false');
    }

    fs.writeFileSync(targetEnv, envContent, 'utf8');
  }

  // Update running process environment
  process.env.UPSTOX_ACCESS_TOKEN = token;
  process.env.USE_MOCK_MARKET_DATA = 'false';

  console.log(`\n🎉 Success! Updated .env.local with fresh access token.`);
  if (userIdentifier) console.log(`   Connected Account: ${userIdentifier}`);
  console.log(`   USE_MOCK_MARKET_DATA set to false for live market streaming.\n`);
}

/**
 * Exchanges authorization code for daily access token
 */
export async function exchangeCodeForToken(code, config) {
  const cfg = config || readEnvConfig();
  console.log('\nExchanging authorization code for daily access token...');
  const res = await fetch('https://api.upstox.com/v2/login/authorization/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upstox API Error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const token = data.access_token;
  saveTokenToEnv(token, data.user_name || data.user_id, cfg.envPath);
  return { success: true, token, user: data.user_name || data.user_id };
}

/**
 * Mode 1: Automated Headless Refresh using Puppeteer (Zero Human Interaction)
 */
export async function runHeadlessPuppeteer(config) {
  const cfg = config || readEnvConfig();
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch {
    return { success: false, error: 'Puppeteer module not found' };
  }

  let execPath = '';
  try {
    const rawPath = puppeteer.executablePath ? await puppeteer.executablePath() : '';
    execPath = typeof rawPath === 'string' ? rawPath : '';
    if (!execPath || !fs.existsSync(execPath)) {
      console.log('ℹ️  Puppeteer Chrome browser binary is not yet downloaded.');
      console.log('👉 To enable 100% background headless automation, run:');
      console.log('   npx puppeteer browsers install chrome\n');
      return { success: false, error: 'Puppeteer Chrome binary not downloaded' };
    }
  } catch {
    console.log('ℹ️  Puppeteer Chrome browser binary is not yet downloaded.');
    console.log('👉 To enable 100% background headless automation, run:');
    console.log('   npx puppeteer browsers install chrome\n');
    return { success: false, error: 'Puppeteer Chrome check failed' };
  }

  console.log('⚡ Zero-Human-Interaction Mode: Detected mobile, PIN, and TOTP key.');
  console.log('🤖 Launching invisible headless browser worker...');

  const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(cfg.clientId)}&redirect_uri=${encodeURIComponent(cfg.redirectUri)}`;

  let browser;
  let callbackServer = null;
  let authCode = null;
  const uniqueProfileDir = path.join(os.tmpdir(), `upstox_prof_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  // Start local callback listener on port 3000 to catch redirect in real-time
  try {
    callbackServer = startLocalCallbackServer(async (code) => {
      if (!authCode && code) {
        authCode = code;
        console.log('   Captured OAuth Authorization Code via local callback server on port 3000!');
      }
    }, cfg.redirectUri);
  } catch {}

  try {
    browser = await puppeteer.launch({
      executablePath: execPath,
      userDataDir: uniqueProfileDir,
      headless: 'new',
      timeout: 20000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // Layer 1: Intercept outgoing network requests (catches redirect before connection)
    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('code=')) {
        try {
          const parsed = new URL(u);
          const c = parsed.searchParams.get('code');
          if (c && !authCode) {
            authCode = c;
            console.log('   Captured OAuth Authorization Code via network request!');
          }
        } catch {}
      }
    });

    // Layer 2: Intercept HTTP 302 Location header responses
    page.on('response', (res) => {
      try {
        const headers = res.headers();
        const loc = headers['location'] || headers['Location'];
        if (loc && loc.includes('code=')) {
          const parsed = new URL(loc.startsWith('http') ? loc : `http://localhost:3000${loc}`);
          const c = parsed.searchParams.get('code');
          if (c && !authCode) {
            authCode = c;
            console.log('   Captured OAuth Authorization Code via HTTP 302 redirect!');
          }
        }
      } catch {}
    });

    // Layer 3: Intercept frame navigations
    page.on('framenavigated', (frame) => {
      try {
        const u = frame.url();
        if (u.includes('code=')) {
          const parsed = new URL(u);
          const c = parsed.searchParams.get('code');
          if (c && !authCode) {
            authCode = c;
            console.log('   Captured OAuth Authorization Code via frame navigation!');
          }
        }
      } catch {}
    });

    console.log('   Navigating to Upstox authorization portal...');
    await page.goto(authUrl, { waitUntil: 'networkidle2', timeout: 25000 });

    // Step 1: Input Mobile Number
    console.log('   Entering registered mobile number...');
    await page.waitForSelector('#mobileNum', { timeout: 15000 });
    await page.type('#mobileNum', cfg.userMobile, { delay: 60 });
    
    // Wait for Get OTP button to be enabled before clicking
    await page.waitForFunction(() => {
      const btn = document.querySelector('#getOtp');
      return btn && !btn.disabled;
    }, { timeout: 10000 });
    await page.click('#getOtp');

    // Step 2: Input TOTP
    console.log('   Awaiting 2FA prompt & computing RFC 6238 TOTP...');
    await page.waitForSelector('#otpNum', { timeout: 15000 });
    const totpCode = generateTotp(cfg.totpKey);
    console.log(`   Generated TOTP: ${totpCode} (RFC 6238 HMAC-SHA1)`);
    await page.type('#otpNum', totpCode, { delay: 60 });

    // Wait for Continue button to be enabled
    await page.waitForFunction(() => {
      const btn = document.querySelector('#continueBtn');
      return btn && !btn.disabled;
    }, { timeout: 10000 });
    await page.click('#continueBtn');

    // Step 3: Input PIN
    console.log('   Entering account PIN...');
    await page.waitForSelector('#pinCode', { timeout: 15000 });
    await page.click('#pinCode');
    await page.type('#pinCode', cfg.userPin, { delay: 80 });

    // Wait for PIN Continue button to be enabled
    await page.waitForFunction(() => {
      const btn = document.querySelector('#pinContinueBtn');
      return btn && !btn.disabled;
    }, { timeout: 10000 });
    await page.click('#pinContinueBtn');
    await page.keyboard.press('Enter').catch(() => {});

    // Step 4: Intercept Redirect Code
    console.log('   Awaiting OAuth code redirection...');

    for (let i = 0; i < 30; i++) {
      if (authCode) break;

      // Check current page URL
      try {
        const curUrl = page.url();
        if (curUrl.includes('code=')) {
          const parsed = new URL(curUrl);
          authCode = parsed.searchParams.get('code');
          if (authCode) {
            console.log('   Captured OAuth Authorization Code via page URL!');
            break;
          }
        }
      } catch {}

      // Check for consent or authorize prompt on page
      if (i >= 2 && !authCode) {
        try {
          const clicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a.btn, input[type="submit"]'));
            for (const b of btns) {
              const txt = (b.textContent || b.value || '').trim().toLowerCase();
              if (
                txt === 'authorize' ||
                txt === 'allow' ||
                txt.includes('authorize') ||
                txt.includes('allow') ||
                txt.includes('accept') ||
                txt.includes('proceed')
              ) {
                if (!b.disabled && b.offsetParent !== null) {
                  b.click();
                  return txt;
                }
              }
            }
            return null;
          });
          if (clicked) {
            console.log(`   Found authorization consent prompt ("${clicked}"), clicked!`);
          }
        } catch {}
      }

      // Check for any visible error message on portal
      if (i >= 2 && !authCode) {
        try {
          const errMsg = await page.evaluate(() => {
            const els = document.querySelectorAll('.error-msg, .alert-danger, [class*="error" i], [id*="error" i], div[role="alert"]');
            for (const el of els) {
              const text = (el.textContent || '').trim();
              if (text && el.offsetParent !== null && !text.includes('©') && text.length < 150) {
                return text;
              }
            }
            return null;
          });
          if (errMsg) {
            console.warn(`   ⚠️ Upstox portal message: "${errMsg}"`);
          }
        } catch {}
      }

      // Diagnostic status every 5 seconds
      if (i > 0 && i % 5 === 0 && !authCode) {
        try {
          const curUrl = page.url();
          const pageTitle = await page.title();
          console.log(`   [${i}s] Waiting... Page: "${pageTitle}" (${curUrl.slice(0, 75)}...)`);
        } catch {}
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    if (authCode) {
      console.log(`   Captured OAuth Authorization Code!`);
      
      // Check if .env.local was already updated (e.g. by Next.js callback route running on port 3000)
      try {
        if (fs.existsSync(cfg.envPath)) {
          const curEnv = fs.readFileSync(cfg.envPath, 'utf8');
          const tMatch = curEnv.match(/UPSTOX_ACCESS_TOKEN=([^\r\n]+)/);
          if (tMatch && tMatch[1]) {
            const parts = tMatch[1].trim().split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
              const ageSec = Math.floor(Date.now() / 1000) - payload.iat;
              if (ageSec >= 0 && ageSec < 90) {
                console.log(`\n🎉 Success! Fresh access token active in .env.local.`);
                console.log(`   Connected Account: ${payload.sub}`);
                console.log(`   Token Issued At (iat): ${payload.iat}`);
                console.log('✅ Zero-Interaction Refresh Complete! Market feed is ready.\n');
                return { success: true, token: tMatch[1].trim(), user: payload.sub };
              }
            }
          }
        }
      } catch (e) {}

      try {
        const result = await exchangeCodeForToken(authCode, cfg);
        console.log('✅ Zero-Interaction Refresh Complete! Market feed is ready.\n');
        return result;
      } catch (err) {
        // If error is code already used (e.g. consumed by Next.js server), verify token in .env.local
        if (err.message.includes('UDAPI100057') && fs.existsSync(cfg.envPath)) {
          const curEnv = fs.readFileSync(cfg.envPath, 'utf8');
          const tMatch = curEnv.match(/UPSTOX_ACCESS_TOKEN=([^\r\n]+)/);
          if (tMatch && tMatch[1]) {
            const parts = tMatch[1].trim().split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
              console.log(`\n🎉 Success! Fresh access token active in .env.local.`);
              console.log(`   Connected Account: ${payload.sub}`);
              console.log('✅ Zero-Interaction Refresh Complete! Market feed is ready.\n');
              return { success: true, token: tMatch[1].trim(), user: payload.sub };
            }
          }
        }
        throw err;
      }
    } else {
      console.warn('⚠️ Could not automatically capture authorization code from page redirection.');
      return { success: false, error: 'Authorization code not found in redirect URL' };
    }
  } catch (err) {
    console.warn(`⚠️ Headless browser automation error: ${err.message}`);
    return { success: false, error: err.message };
  } finally {
    if (callbackServer) {
      try { callbackServer.close(); } catch {}
    }
    if (browser) {
      try { await browser.close(); } catch {}
    }
    try { fs.rmSync(uniqueProfileDir, { recursive: true, force: true }); } catch {}
  }
}

/**
 * Mode 2: Semi-Automated Local Interceptor Server
 * Listens on the redirect port so clicking the auth link in browser completes
 * the token exchange in <200ms without copying and pasting codes.
 */
export function startLocalCallbackServer(onCodeReceived, customRedirectUri) {
  try {
    const redirectUrl = customRedirectUri || 'http://localhost:3000/api/auth/callback/upstox';
    const parsedRedirect = new URL(redirectUrl);
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
    return server;
  } catch (e) {
    return null;
  }
}

/**
 * Mode 3: Interactive Prompt Mode (with Auto-Browser Launch)
 */
export function runInteractiveMode(config) {
  const cfg = config || readEnvConfig();

  return new Promise((resolve, reject) => {
    const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(cfg.clientId)}&redirect_uri=${encodeURIComponent(cfg.redirectUri)}`;

    console.log('1. Opening Upstox authorization in your default browser...\n');
    console.log(`\x1b[36m${authUrl}\x1b[0m\n`);
    console.log('2. Log in with your mobile number, OTP, and 6-digit PIN.');
    console.log('3. Upstox will redirect back to:');
    console.log(`   ${cfg.redirectUri}?code=YOUR_CODE_HERE\n`);

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
    const server = startLocalCallbackServer(async (code) => {
      if (codeHandled) return;
      codeHandled = true;
      try {
        const result = await exchangeCodeForToken(code, cfg);
        resolve(result);
      } catch (err) {
        console.error('❌ Request failed:', err.message);
        reject(err);
      }
    }, cfg.redirectUri);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Paste authorization code or redirect URL (if not auto-captured): ', async (input) => {
      rl.close();
      if (server) try { server.close(); } catch {}
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
        reject(new Error('No authorization code provided.'));
        return;
      }

      codeHandled = true;
      try {
        const result = await exchangeCodeForToken(code, cfg);
        resolve(result);
      } catch (err) {
        console.error('❌ Request failed:', err.message);
        if (err.message.includes('UDAPI100057')) {
          console.log('\n💡 Upstox Error UDAPI100057 (Invalid Auth Code) happens because:');
          console.log('   - Upstox codes expire after ~60 seconds, or have already been exchanged.');
          console.log('👉 Simply run "npm run upstox:token" again to get a fresh code in seconds!\n');
        }
        reject(err);
      }
    });
  });
}

/**
 * Unified Token Refresher Entrypoint
 */
export async function refreshUpstoxToken(options = {}) {
  const cfg = options.config || readEnvConfig(options.envPath);

  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error('UPSTOX_CLIENT_ID and UPSTOX_CLIENT_SECRET are required in .env.local');
  }

  // 1. If headless credentials exist, try automated headless login
  if (cfg.userMobile && cfg.userPin && cfg.totpKey) {
    const headlessResult = await runHeadlessPuppeteer(cfg);
    if (headlessResult.success) {
      return headlessResult;
    }
    if (options.headlessOnly) {
      return headlessResult;
    }
  }

  // 2. Otherwise fallback to interactive mode if allowed
  if (options.interactive !== false) {
    return await runInteractiveMode(cfg);
  }

  return { success: false, error: 'Headless credentials not configured and interactive mode disabled' };
}

// Standalone CLI execution
async function main() {
  const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
  if (!isDirectRun) return;

  const isIfNeeded = process.argv.includes('--if-needed');
  const cfg = readEnvConfig();

  console.log('\n================================================================');
  console.log('            IPOLENS — Upstox Access Token Refresher              ');
  console.log('================================================================\n');

  if (!cfg.clientId || !cfg.clientSecret) {
    console.log('⚠️  Please add UPSTOX_CLIENT_ID and UPSTOX_CLIENT_SECRET to .env.local first:');
    console.log('   UPSTOX_CLIENT_ID=your_api_key_here');
    console.log('   UPSTOX_CLIENT_SECRET=your_api_secret_here\n');
    console.log('Get them from https://developer.upstox.com/ (Apps -> Create App)');
    console.log('Set Redirect URL in Upstox App to: ' + cfg.redirectUri + '\n');
    process.exit(1);
  }

  if (isIfNeeded) {
    const validity = checkTokenValidity(cfg);
    if (validity.valid) {
      console.log(`✓ Upstox access token is active and valid for account ${validity.account} (~${validity.hoursLeft}h left).`);
      process.exit(0);
    }
  }

  try {
    const result = await refreshUpstoxToken({ config: cfg, interactive: true });
    process.exit(result && result.success ? 0 : 1);
  } catch (err) {
    console.error('❌ Token refresh failed:', err.message);
    process.exit(1);
  }
}

main();
