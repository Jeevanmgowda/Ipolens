#!/usr/bin/env node
/**
 * Drives the IPO sync endpoint (POST /api/scraper/sync) with CRON_SECRET from .env.local.
 *
 *   node scripts/ingest.mjs live          one live sync (InvestorGain + BSE)
 *   node scripts/ingest.mjs backfill      12-month backfill, batch after batch until done
 *   node scripts/ingest.mjs import-json   one-time import of data/ipos.json
 *   node scripts/ingest.mjs all           live, then backfill, then import-json (first load)
 *   node scripts/ingest.mjs watch         live sync every 15 min in market hours (IST), hourly otherwise
 *
 * IPOLENS_URL overrides the server address (default http://localhost:3000).
 */
import fs from 'node:fs';
import path from 'node:path';

const envFile = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const BASE = process.env.IPOLENS_URL || 'http://localhost:3000';
const SECRET = process.env.CRON_SECRET;
if (!SECRET) {
  console.error('CRON_SECRET is not set (.env.local).');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sync(body) {
  const res = await fetch(`${BASE}/api/scraper/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 502) throw new Error(`HTTP ${res.status}: ${json.error || 'sync failed'}`);
  return json;
}

const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

async function live() {
  const { report, success } = await sync({ mode: 'live' });
  console.log(
    `[${stamp()}] live ${success ? 'ok' : 'PARTIAL'}: ${report.upserted}/${report.detailsFetched} IPOs, ` +
      `+${report.gmpPointsAdded} GMP points, BSE-only ${report.bseOnlyAdded}` +
      (report.errors.length ? `, ${report.errors.length} errors: ${report.errors.slice(0, 3).join(' | ')}` : '')
  );
}

async function backfill() {
  let fromId;
  let total = 0;
  for (let batch = 1; batch <= 200; batch++) {
    const { report } = await sync({ mode: 'backfill', fromId, maxRequests: 45 });
    total += report.ingested;
    console.log(
      `[${stamp()}] backfill batch ${batch}: ids ${report.fromId}→${report.nextId}, +${report.ingested} IPOs ` +
        `(known ${report.skippedKnown}, old ${report.olderThanWindow}, gaps ${report.misses})` +
        (report.errors.length ? ` errors: ${report.errors.slice(0, 2).join(' | ')}` : '')
    );
    if (report.done) {
      console.log(`backfill done: ${report.doneReason} Total added: ${total}. Window starts ${report.cutoffDate}.`);
      return;
    }
    if (report.errors.some((e) => /refused/.test(e))) {
      console.log('Upstream is rate-limiting; waiting 2 minutes before continuing.');
      await sleep(120_000);
    }
    fromId = report.nextId;
  }
}

async function importJson() {
  const { report } = await sync({ mode: 'import-json' });
  console.log(
    `[${stamp()}] import-json (snapshot ${report.snapshotDate}): ${report.total} rows, ` +
      `${report.matchedExisting} matched, ${report.inserted} inserted, +${report.gmpPointsAdded} GMP points` +
      (report.errors.length ? `, errors: ${report.errors.slice(0, 3).join(' | ')}` : '')
  );
}

function isMarketHoursIst(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  const day = ist.getUTCDay();
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return day >= 1 && day <= 5 && minutes >= 9 * 60 && minutes <= 17 * 60 + 30;
}

async function watch() {
  console.log(`Watching ${BASE}: every 15 min in market hours (IST), hourly otherwise. Ctrl+C to stop.`);
  for (;;) {
    try {
      await live();
    } catch (err) {
      console.error(`[${stamp()}] live sync failed: ${err.message}`);
    }
    await sleep(isMarketHoursIst() ? 15 * 60_000 : 60 * 60_000);
  }
}

const mode = process.argv[2] || 'live';
const run = { live, backfill, 'import-json': importJson, watch, all: async () => { await live(); await backfill(); await importJson(); } }[mode];
if (!run) {
  console.error('Usage: node scripts/ingest.mjs <live|backfill|import-json|all|watch>');
  process.exit(1);
}
run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
