import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { extractDetailPayload, parseDetailPayload } from '@/lib/ingestion/investorgain';
import { ingestIgDetail } from '@/lib/ingestion/ipo-ingestion.service';
import { IpoRepository } from '@/lib/repositories/ipo.repository';
import { SupabaseIpoProvider, clearSupabaseIpoCache, remainingTimeFor, toLiveIpoDetail } from '@/services/supabaseIpoProvider';
import { IpoService } from '@/services/ipoService';
import { parseYahooQuote, yahooTicker } from '@/lib/ingestion/quotes';
import { createTestDatabase } from './helpers/testDb';

const fx = (f: string) => fs.readFileSync(path.join(__dirname, 'fixtures/ingestion', f), 'utf8');
const openDetail = () => parseDetailPayload(extractDetailPayload(fx('investorgain-detail-open.html'))!)!;

const bare = (id: string, symbol: string, extra: Partial<Parameters<typeof IpoRepository.upsert>[0]> = {}) => ({
  id,
  symbol,
  companyName: `${symbol} Limited`,
  series: 'EQ' as const,
  priceLow: 100,
  priceHigh: 110,
  lotSize: null,
  issueSizeCr: null,
  freshIssueCr: null,
  ofsCr: null,
  openDate: '2099-01-10',
  closeDate: '2099-01-12',
  allotmentDate: null,
  listingDate: null,
  registrar: null,
  registrarSlug: null,
  exchange: null,
  issuePrice: 110,
  listingPrice: null,
  source: 'BSE',
  extra: {},
  ...extra,
});

describe('Supabase IPO read path', () => {
  let close: () => Promise<void>;
  beforeEach(async () => {
    ({ close } = await createTestDatabase());
    clearSupabaseIpoCache();
  });
  afterEach(async () => close());

  it('maps stored IPOs with provenance and flags unknown values instead of inventing them', async () => {
    const detail = openDetail();
    await ingestIgDetail(detail);
    await IpoRepository.upsert(bare('bse_1', 'NOLOT'));
    const provider = new SupabaseIpoProvider();

    const real = (await provider.getIpoDetails('FOODLINK'))!;
    expect(real.hasGmpData).toBe(true);
    expect(real.isAiPredictedGmp).toBe(false);
    expect(real.gmpSource).toBe('InvestorGain');
    expect(real.hasSubscriptionData).toBe(true);
    expect(real.lotSize).toBe(78);
    expect(real.dataSource).toBe('InvestorGain');

    const unknown = (await provider.getIpoDetails('NOLOT'))!;
    expect(unknown.lotSize).toBe(0); // shown as —, not a made-up lot
    expect(unknown.hasSubscriptionData).toBe(false);
    expect(unknown.hasGmpData).toBe(false);
    expect(unknown.registrar).toBe('—');
    // No market GMP for an upcoming issue: AI estimate, always labelled as such.
    expect(unknown.isAiPredictedGmp).toBe(true);
  });

  it('leaves DRHP filings without dates out of the market lists', async () => {
    await IpoRepository.upsert(bare('ig_9', 'DRHPONLY', { openDate: null, closeDate: null }));
    await IpoRepository.upsert(bare('ig_10', 'DATED'));
    const all = await new SupabaseIpoProvider().getAllIpos();
    expect(all.map((i) => i.symbol)).toEqual(['DATED']);
  });

  it('serves real GMP history and no subscription when none was recorded', async () => {
    const detail = openDetail();
    await ingestIgDetail(detail);
    await IpoRepository.upsert(bare('bse_2', 'NOSUB'));

    const history = (await IpoService.getGmpHistory('FOODLINK', 'All'))!;
    expect(history.points.length).toBe(detail.gmpHistory.length);
    expect(history.points.map((p) => p.gmp)).toEqual([...detail.gmpHistory].sort((a, b) => a.date.localeCompare(b.date)).map((g) => g.gmp));
    expect(history.sources?.[0].sourceName).toBe('InvestorGain');

    expect(await IpoService.getSubscription('NOSUB')).toBeNull();
    const sub = (await IpoService.getSubscription('FOODLINK'))!;
    expect(sub.total).toBeGreaterThan(0);
    expect(sub.totalSharesBid).toBeUndefined();
  });

  it('builds the legacy detail payload without fabricated bid splits', async () => {
    await IpoRepository.upsert(bare('bse_3', 'PLAIN'));
    const item = (await new SupabaseIpoProvider().getIpoDetails('PLAIN'))!;
    const d = toLiveIpoDetail(item);
    expect(d.bidDetails).toEqual([]);
    expect(d.biddingDetails).toEqual({});
    expect(d.graphData).toEqual([]);
    expect(d.registrarSlug).toBe('other');
  });
});

describe('Lifecycle labels and quotes', () => {
  it('computes remaining time from the calendar (IST)', () => {
    const now = new Date('2026-11-27T06:00:00Z');
    expect(remainingTimeFor({ status: 'Open', openDate: '2026-11-25', closeDate: '2026-11-27' }, now).remainingTime).toBe('Closes today');
    expect(remainingTimeFor({ status: 'Upcoming', openDate: '2026-12-01', closeDate: null }, now).remainingTime).toBe('Opens in 4 days');
    expect(remainingTimeFor({ status: 'Closed', openDate: null, closeDate: null }, now).remainingTime).toBe('Bidding Closed');
  });

  it('maps symbols to Yahoo tickers and parses a chart payload', () => {
    expect(yahooTicker('FOODLINK')).toBe('FOODLINK.NS');
    expect(yahooTicker('BSE544321')).toBe('544321.BO');
    expect(yahooTicker('bad symbol!')).toBeNull();
    const q = parseYahooQuote({
      chart: {
        result: [
          {
            meta: { regularMarketPrice: 120, regularMarketVolume: 5000 },
            indicators: { quote: [{ open: [100, 105, 118], close: [101, 110, 120] }] },
          },
        ],
      },
    })!;
    expect(q.previousClose).toBe(110);
    expect(q.change).toBe(10);
    expect(q.open).toBe(118);
    expect(parseYahooQuote({ chart: { result: [{ meta: {} }] } })).toBeNull();
  });
});
