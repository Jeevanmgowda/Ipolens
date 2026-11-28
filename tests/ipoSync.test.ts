import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { extractDetailPayload, parseDetailPayload, type IgIpoDetail } from '@/lib/ingestion/investorgain';
import { ingestIgDetail } from '@/lib/ingestion/ipo-ingestion.service';
import { importSnapshot, snapshotToUpsert } from '@/lib/ingestion/json-import';
import { runBackfill } from '@/lib/ingestion/backfill';
import { recordSyncRun, readSyncHealth } from '@/lib/ingestion/sync-health';
import { IpoRepository } from '@/lib/repositories/ipo.repository';
import { UpstreamError } from '@/lib/ingestion/http';
import { createSession } from '@/lib/security/session';
import { POST as syncPost, GET as syncGet } from '@/app/api/scraper/sync/route';
import { createTestDatabase } from './helpers/testDb';

const fx = (f: string) => fs.readFileSync(path.join(__dirname, 'fixtures/ingestion', f), 'utf8');
const openDetail = () => parseDetailPayload(extractDetailPayload(fx('investorgain-detail-open.html'))!)!;

describe('Snapshot import (data/ipos.json)', () => {
  let close: () => Promise<void>;
  beforeEach(async () => {
    ({ close } = await createTestDatabase());
  });
  afterEach(async () => close());

  it('maps only verified snapshot fields and leaves the rest null', () => {
    const rec = snapshotToUpsert(
      {
        symbol: 'WATRANA',
        companyName: 'Watrana Rentals Limited',
        series: 'SME',
        exchanges: ['NSE'],
        openDate: '2026-11-19',
        closeDate: '2026-11-23',
        listingDate: '2026-11-27',
        priceBand: { min: 232, max: 245 },
        lotSize: '600',
        issueSize: '₹120.10 Cr',
        gmp: { value: 25, percent: 10.2 },
      },
      '2026-11-17'
    )!;
    expect(rec.id).toBe('snap_WATRANA');
    expect(rec.series).toBe('SME');
    expect(rec.lotSize).toBe(600);
    expect(rec.issueSizeCr).toBe(120.1);
    expect(rec.registrar).toBeNull();
    expect(rec.freshIssueCr).toBeNull();
    expect(rec.source).toBe('NSE/BSE snapshot 2026-11-17');
  });

  it('inserts unknown IPOs, adds GMP to matching stored IPOs without overwriting them', async () => {
    const detail = openDetail();
    await ingestIgDetail(detail);
    const before = await IpoRepository.getBySymbol('FOODLINK');

    const report = await importSnapshot({
      generatedAt: '2026-11-17T14:04:04Z',
      ipos: [
        { symbol: 'FOODLINK', companyName: detail.companyName, priceBand: { min: 1, max: 2 }, gmp: { value: 7 } },
        { symbol: 'NEWCO', companyName: 'New Co Limited', priceBand: { min: 100, max: 110 }, gmp: { value: 11 } },
        { symbol: '', companyName: 'No Symbol Ltd' },
      ],
    });
    expect(report).toMatchObject({ total: 3, matchedExisting: 1, inserted: 1, skipped: 1, gmpPointsAdded: 2 });

    const after = await IpoRepository.getBySymbol('FOODLINK');
    expect(after!.priceHigh).toBe(before!.priceHigh); // not overwritten by the snapshot
    expect(after!.source).toBe('InvestorGain');
    const newco = await IpoRepository.getBySymbol('NEWCO');
    expect(newco!.source).toBe('NSE/BSE snapshot 2026-11-17');

    // Importing twice adds nothing new.
    const again = await importSnapshot({
      generatedAt: '2026-11-17T14:04:04Z',
      ipos: [{ symbol: 'NEWCO', companyName: 'New Co Limited', gmp: { value: 11 } }],
    });
    expect(again.gmpPointsAdded).toBe(0);
  });

  it('a later InvestorGain record supersedes the snapshot row and keeps its GMP points', async () => {
    const detail = openDetail();
    await importSnapshot({
      generatedAt: '2026-11-17T00:00:00Z',
      ipos: [{ symbol: 'FOODLINK', companyName: 'Some Other Name', gmp: { value: 9 } }],
    });
    expect((await IpoRepository.getBySymbol('FOODLINK'))!.id).toBe('snap_FOODLINK');

    await ingestIgDetail(detail);
    const rec = await IpoRepository.getBySymbol('FOODLINK');
    expect(rec!.id).toBe(`ig_${detail.igId}`);
    expect(await IpoRepository.getById('snap_FOODLINK')).toBeNull();
    const history = await IpoRepository.gmpHistory('FOODLINK');
    expect(history.length).toBe(detail.gmpHistory.length + 1);
  });
});

describe('12-month backfill', () => {
  let close: () => Promise<void>;
  beforeEach(async () => {
    ({ close } = await createTestDatabase());
  });
  afterEach(async () => close());

  const fakeDetail = (base: IgIpoDetail, id: number, openDate: string): IgIpoDetail => ({
    ...base,
    igId: id,
    nseSymbol: `SYM${id}`,
    companyName: `Company ${id} Limited`,
    shortName: `Company ${id}`,
    openDate,
    closeDate: openDate,
    listingDate: openDate,
    gmpHistory: [],
  });

  it('walks ids downward, skips stored ids, ignores gaps and stops after the window', async () => {
    const base = openDetail();
    await ingestIgDetail(fakeDetail(base, 100, '2026-11-20'));
    await ingestIgDetail(fakeDetail(base, 98, '2026-11-01'));
    const calls: number[] = [];
    const fetchDetail = async (id: number) => {
      calls.push(id);
      if (id === 97) throw new UpstreamError('InvestorGain', 'Could not parse IPO detail payload');
      return fakeDetail(base, id, id >= 95 ? '2026-06-01' : '2024-01-01');
    };

    const first = await runBackfill({ fetchDetail, delayMs: 0, maxRequests: 3, stopAfterOld: 3 });
    expect(first.fromId).toBe(100);
    expect(calls).toEqual([99, 97, 96]); // 100 and 98 are already stored
    expect(first).toMatchObject({ ingested: 2, misses: 1, skippedKnown: 2, done: false, nextId: 95 });

    const second = await runBackfill({ fetchDetail, delayMs: 0, fromId: first.nextId, stopAfterOld: 3 });
    expect(second.done).toBe(true);
    expect(second.olderThanWindow).toBe(3);
    expect(await IpoRepository.getBySymbol('SYM95')).not.toBeNull();
    expect(await IpoRepository.getBySymbol('SYM94')).toBeNull(); // older than 12 months
  });

  it('stops the batch when the upstream rate-limits', async () => {
    const base = openDetail();
    await ingestIgDetail(fakeDetail(base, 50, '2026-11-20'));
    const report = await runBackfill({
      delayMs: 0,
      fetchDetail: async () => {
        throw new UpstreamError('InvestorGain', 'HTTP 429', 429);
      },
    });
    expect(report.requests).toBe(1);
    expect(report.done).toBe(false);
    expect(report.nextId).toBe(49);
  });
});

describe('Sync endpoint and health', () => {
  let close: () => Promise<void>;
  beforeEach(async () => {
    ({ close } = await createTestDatabase());
  });
  afterEach(async () => close());

  const post = (body: unknown, headers: Record<string, string> = {}) =>
    new Request('http://localhost/api/scraper/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

  it('rejects anonymous callers, non-admins and a wrong CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'test-cron-secret-value';
    expect((await syncPost(post({ mode: 'live' }))).status).toBe(403);
    expect((await syncPost(post({ mode: 'live' }, { authorization: 'Bearer wrong' }))).status).toBe(403);
    const { token } = await createSession('usr_ret_02', false);
    expect((await syncPost(post({ mode: 'live' }, { cookie: `ipolens_session=${token}` }))).status).toBe(403);
  });

  it('GET is a read-only status without the cron secret', async () => {
    process.env.CRON_SECRET = 'test-cron-secret-value';
    const res = await syncGet(new Request('http://localhost/api/scraper/sync', { headers: { authorization: 'Bearer wrong' } }));
    expect(res.status).toBe(200);
    expect((await res.json()).store).toBe('supabase');
  });

  it('rejects an unknown mode for an authorised caller', async () => {
    process.env.CRON_SECRET = 'test-cron-secret-value';
    const res = await syncPost(post({ mode: 'rm -rf' }, { authorization: 'Bearer test-cron-secret-value' }));
    expect(res.status).toBe(400);
  });

  it('records runs and reports the last successful live sync', async () => {
    await recordSyncRun({ mode: 'backfill', startedAt: '2026-11-27T00:00:00Z', ok: true, summary: {} });
    expect((await readSyncHealth()).lastSuccessAt).toBeNull();
    await recordSyncRun({ mode: 'live', startedAt: '2026-11-27T01:00:00Z', finishedAt: '2026-11-27T01:01:00Z', ok: true, summary: {} });
    const health = await readSyncHealth();
    expect(health.lastSuccessAt).toBe('2026-11-27T01:01:00Z');
    expect(health.lastRun?.mode).toBe('live');
  });
});
