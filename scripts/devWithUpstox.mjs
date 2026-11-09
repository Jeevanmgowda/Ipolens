#!/usr/bin/env node

/**
 * IPOLENS — Development Server with Upstox Token Lifecycle Management
 * 
 * Automatically manages Upstox market data access tokens when running `npm run dev`:
 * 1. Checks if USE_MOCK_MARKET_DATA is enabled or Upstox credentials are configured.
 * 2. Inspects existing UPSTOX_ACCESS_TOKEN for validity (JWT expiration in <1ms).
 * 3. If token is valid: starts Next.js dev server immediately (<50ms).
 * 4. If token is expired or missing:
 *    - In headless mode (mobile, PIN, TOTP): refreshes token in background (~3s) and writes to .env.local.
 *    - In fallback mode: starts dev server and prints the 1-click browser auth link.
 * 5. Passes all CLI flags (e.g., -p 3001, --turbopack) directly to Next.js.
 * 
 * Usage:
 *   npm run dev
 *   npm run dev -- --refresh        (force refresh token)
 *   npm run dev -- --skip-token     (skip token check and start Next.js directly)
 *   npm run dev -- -p 3001          (custom port forwarded to Next.js)
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { readEnvConfig, checkTokenValidity, refreshUpstoxToken } from './getUpstoxToken.mjs';

async function main() {
  const rawArgs = process.argv.slice(2);
  const forceRefresh = rawArgs.includes('--force-refresh') || rawArgs.includes('-r') || rawArgs.includes('--refresh');
  const skipToken = rawArgs.includes('--skip-token') || rawArgs.includes('--no-token');
  const nextArgs = rawArgs.filter(arg => !['--force-refresh', '-r', '--refresh', '--skip-token', '--no-token'].includes(arg));

  const config = readEnvConfig();

  console.log('\n\x1b[38;2;14;165;233m┌────────────────────────────────────────────────────────┐\x1b[0m');
  console.log('\x1b[38;2;14;165;233m│\x1b[0m       \x1b[1m\x1b[37mIPOLENS — Development Server with Upstox\x1b[0m        \x1b[38;2;14;165;233m│\x1b[0m');
  console.log('\x1b[38;2;14;165;233m└────────────────────────────────────────────────────────┘\x1b[0m\n');

  // Check scraper feed status (scripts/scraper/ -> data/ipos.json)
  const dataPath = path.resolve(process.cwd(), 'data', 'ipos.json');
  if (fs.existsSync(dataPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      const count = Array.isArray(data.ipos) ? data.ipos.length : 0;
      console.log(`\x1b[32m[IPOLENS] ✓ IPO Scraper cache active (${count} records in data/ipos.json)\x1b[0m`);
    } catch {
      // Ignore JSON parse error
    }
  } else {
    console.log('\x1b[90m[IPOLENS] ℹ️  data/ipos.json not found. Run "npm run scrape" to scrape NSE, BSE & GMP data.\x1b[0m');
  }

  if (skipToken) {
    console.log('\x1b[33m[IPOLENS]\x1b[0m ⏭️  Skipping Upstox token check (--skip-token).\n');
    return startNextDev(nextArgs);
  }

  if (config.useMock) {
    console.log('\x1b[33m[IPOLENS]\x1b[0m ℹ️  USE_MOCK_MARKET_DATA=true. Running dev server with simulated market data.\n');
    return startNextDev(nextArgs);
  }

  if (!config.clientId || !config.clientSecret) {
    console.log('\x1b[33m[IPOLENS]\x1b[0m ℹ️  Upstox credentials not configured in .env.local. Starting Next.js in demo mode.\n');
    return startNextDev(nextArgs);
  }

  // Check token status
  if (!forceRefresh) {
    const validity = checkTokenValidity(config);
    if (validity.valid) {
      console.log(`\x1b[32m[IPOLENS] ✓ Upstox session active for account ${validity.account} (~${validity.hoursLeft}h remaining).\x1b[0m\n`);
      return startNextDev(nextArgs);
    } else {
      console.log(`\x1b[33m[IPOLENS] ⚠️  Upstox access token needs refresh: ${validity.reason}\x1b[0m`);
    }
  } else {
    console.log('\x1b[36m[IPOLENS] 🔄 Force refresh requested (--refresh).\x1b[0m');
  }

  // Token needs refresh
  if (config.userMobile && config.userPin && config.totpKey) {
    console.log('\x1b[36m[IPOLENS] ⚡ Refreshing token automatically via headless worker (Zero interaction)...\x1b[0m');
    try {
      const res = await refreshUpstoxToken({ config, headlessOnly: true });
      if (res && res.success) {
        console.log(`\x1b[32m[IPOLENS] 🎉 Upstox token successfully updated in .env.local!\x1b[0m\n`);
      } else {
        console.warn(`\x1b[33m[IPOLENS] ⚠️  Headless refresh could not complete. Continuing to launch dev server...\x1b[0m`);
        console.log(`\x1b[90m[IPOLENS] (Tip: Run "npm run upstox:token" in another terminal or visit /api/auth/upstox to re-authenticate)\x1b[0m\n`);
      }
    } catch (err) {
      console.warn(`\x1b[33m[IPOLENS] ⚠️  Token refresh encountered an issue: ${err.message}\x1b[0m`);
      console.log(`\x1b[90m[IPOLENS] Continuing with dev server launch...\x1b[0m\n`);
    }
  } else {
    console.log('\x1b[33m[IPOLENS] ℹ️  Headless credentials not set. Launching Next.js on port 3000.\x1b[0m');
    console.log(`\x1b[36m[IPOLENS] 👉 Connect Upstox via browser: http://localhost:3000/api/auth/upstox\x1b[0m\n`);
  }

  return startNextDev(nextArgs);
}

/**
 * Spawns the Next.js development server and forwards CLI args and signals
 */
function startNextDev(nextArgs = []) {
  const nextCli = path.resolve(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
  
  if (!fs.existsSync(nextCli)) {
    console.error('❌ Could not locate Next.js binary in node_modules.');
    process.exit(1);
  }

  console.log(`\x1b[36m[IPOLENS]\x1b[0m 🚀 Launching Next.js development server...\n`);

  const child = spawn(process.execPath, [nextCli, 'dev', ...nextArgs], {
    stdio: 'inherit',
    env: { ...process.env },
  });

  const forward = (sig) => {
    try {
      if (child && !child.killed) child.kill(sig);
    } catch {}
  };

  process.on('SIGINT', () => forward('SIGINT'));
  process.on('SIGTERM', () => forward('SIGTERM'));

  child.on('exit', (code, signal) => {
    process.exit(code ?? (signal ? 1 : 0));
  });
}

main();

