import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { extractDetailPayload, parseDetailPayload, type IgIpoDetail } from '@/lib/ingestion/investorgain';
import { ingestIgDetail } from '@/lib/ingestion/ipo-ingestion.service';
import { isActive, maxAgeMs, refreshActiveIpos } from '@/lib/ingestion/active-refresh';
import { IpoRepository, todayIst } from '@/lib/repositories/ipo.repository';
import { clearSupabaseIpoCache } from '@/services/supabaseIpoProvider';
import { createTestDatabase } from './helpers/testDb';

const fx = (f: string) => fs.readFileSync(path.join(__dirname, 'fixtures/ingestion', f), 'utf8');
const base = () => parseDetailPayload(extractDetailPayload(fx('investorgain-detail-open.html'))!)!;

describe('Active IPO refresh', () => {
  let close: () => Promise<void>;
  beforeEach(async () => {
    ({ close } = await createTestDatabase());
    clearSupabaseIpoCache();
  });
  afterEach(async () => close());

  it('classifies active issues and their freshness window', () => {
    const now = new Date('2026-11-27T05:00:00Z'); // Friday 10:30 IST
    expect(isActive({ status: 'Open', openDate: '2026-11-25', listingDate: '2026-12-03' }, now)).toBe(true);
    expect(isActive({ status: 'Upcoming', openDate: '2026-11-30', listingDate: null }, now)).toBe(true);
    expect(isActive({ status: 'Upcoming', openDate: '2026-12-15', listingDate: null }, now)).toBe(false);
    expect(isActive({ status: 'Upcoming', openDate: null, listingDate: null }, now)).toBe(false);
    expect(isActive({ status: 'Closed', openDate: '2026-11-20', listingDate: '2026-11-28' }, now)).toBe(true);
    expect(isActive({ status: 'Listed', openDate: '2026-11-01', listingDate: '2026-11-08' }, now)).toBe(false);
    expect(maxAgeMs({ status: 'Open' }, now)).toBe(3 * 60_000);
    expect(maxAgeMs({ status: 'Open' }, new Date('2026-11-28T05:00:00Z'))).toBe(15 * 60_000); // Saturday
  });

  it('re-reads only stale active IPOs and updates today’s GMP in place', async () => {
    const today = todayIst();
    const detail: IgIpoDetail = {
      ...base(),
      openDate: today,
      closeDate: today,
      listingDate: '2099-01-01',
      gmpHistory: [{ date: today, gmp: 10 } as IgIpoDetail['gmpHistory'][number]],
    };
    await ingestIgDetail(detail);
    const sym = (await IpoRepository.listAll())[0].symbol;

    const calls: number[] = [];
    const fetchDetail = async (id: number) => {
      calls.push(id);
      return { ...detail, gmpHistory: [{ date: today, gmp: 14 } as IgIpoDetail['gmpHistory'][number]] };
    };

    // Just stored: fresh, so no upstream call.
    const first = await refreshActiveIpos({ symbols: [sym], fetchDetail });
    expect(first).toMatchObject({ active: 1, stale: 0, refreshed: [] });
    expect(calls).toEqual([]);

    // An hour later it is stale: refetched once, and today's GMP point moves from 10 to 14.
    const later = new Date(Date.now() + 60 * 60_000);
    const second = await refreshActiveIpos({ symbols: [sym], fetchDetail, now: later });
    expect(second.refreshed).toEqual([sym]);
    expect(calls).toEqual([detail.igId]);
    const history = await IpoRepository.gmpHistory(sym);
    expect(history.filter((h) => h.date === today).map((h) => h.gmp)).toEqual([14]);
  });
});
