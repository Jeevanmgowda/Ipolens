#!/usr/bin/env node

/**
 * IPOLENS — Upstox Access Token Helper
 * 
 * Usage:
 *   node scripts/getUpstoxToken.mjs
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const envPath = path.resolve(process.cwd(), '.env.local');

let clientId = process.env.UPSTOX_CLIENT_ID || '';
let clientSecret = process.env.UPSTOX_CLIENT_SECRET || '';

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  const idMatch = content.match(/UPSTOX_CLIENT_ID=([^\r\n]+)/);
  const secMatch = content.match(/UPSTOX_CLIENT_SECRET=([^\r\n]+)/);
  if (idMatch && idMatch[1] && !idMatch[1].startsWith('your_')) clientId = idMatch[1].trim();
  if (secMatch && secMatch[1] && !secMatch[1].startsWith('your_')) clientSecret = secMatch[1].trim();
}

const redirectUri = 'http://localhost:3000/api/auth/callback/upstox';

console.log('\n======================================================');
console.log('       IPOLENS — Upstox V3 API Token Generator        ');
console.log('======================================================\n');

if (!clientId || !clientSecret) {
  console.log('⚠️  Please add your UPSTOX_CLIENT_ID and UPSTOX_CLIENT_SECRET to .env.local first:');
  console.log('   UPSTOX_CLIENT_ID=your_api_key_here');
  console.log('   UPSTOX_CLIENT_SECRET=your_api_secret_here\n');
  console.log('Get them from https://developer.upstox.com/ (Apps -> Create App)');
  console.log('Set Redirect URL in Upstox App to: ' + redirectUri + '\n');
  process.exit(1);
}

const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

console.log('1. Open this URL in your browser to log in to Upstox:\n');
console.log(`\x1b[36m${authUrl}\x1b[0m\n`);
console.log('2. Log in with your mobile number, OTP, and 6-digit PIN.');
console.log('3. Upstox will redirect your browser to:');
console.log(`   ${redirectUri}?code=YOUR_CODE_HERE\n`);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Paste the authorization "code" parameter (or the full redirect URL) here: ', async (input) => {
  rl.close();

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

  console.log('\nExchanging authorization code for daily access token...');

  try {
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
      console.error(`❌ Upstox API Error (${res.status}):`, err);
      process.exit(1);
    }

    const data = await res.json();
    const token = data.access_token;

    console.log('\n✅ Access Token Generated Successfully!');
    console.log(`User: ${data.user_name || data.user_id}`);
    console.log('\nToken:');
    console.log(`\x1b[32m${token}\x1b[0m\n`);

    if (fs.existsSync(envPath)) {
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
      console.log('🎉 Updated .env.local: Set UPSTOX_ACCESS_TOKEN and enabled USE_MOCK_MARKET_DATA=false!');
    }
  } catch (err) {
    console.error('❌ Request failed:', err.message);
  }
});
