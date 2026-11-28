import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IpoRepository } from '@/lib/repositories/ipo.repository';
import { clearMarketDataCaches, getCandles, getIpoChart, getLiveQuote, getLiveQuotes } from '@/lib/market/ipoMarketData';
import { clearSupabaseIpoCache } from '@/services/supabaseIpoProvider';
import { GET as quotesRoute } from '@/app/api/ipos/quotes/route';
import { MarketService } from '@/services/marketService';
import { createTestDatabase } from './helpers/testDb';

const day = (iso: string) => Math.floor(new Date(`${iso}T09:15:00+05:30`).getTime() / 1000);

function chart(price: number, closes: number[], dates: string[]) {
  return {
    chart: {
      result: [
        {
          meta: { regularMarketPrice: price, regularMarketVolume: 1234, currency: 'INR', fiftyTwoWeekHigh: 150, fiftyTwoWeekLow: 90 },
          timestamp: dates.map(day),
          indicators: { quote: [{ open: closes, high: closes, low: closes, close: closes, volume: closes.map(() => 10) }] },
        },
      ],
    },
  };
}

const seed = (symbol: string, exchange: string, extra: Record<string, unknown> = {}) =>
  IpoRepository.upsert({
    id: `ig_${symbol}`,
    symbol,
    companyName: `${symbol} Limited`,
    series: exchange.includes('SME') ? 'SME' : 'EQ',
    priceLow: 95,
    priceHigh: 100,
    lotSize: 100,
    issueSizeCr: 50,
    freshIssueCr: null,
    ofsCr: null,
    openDate: '2026-10-01',
    closeDate: '2026-10-03',
    allotmentDate: '2026-10-06',
    listingDate: '2026-10-08',
    registrar: null,
    registrarSlug: null,
    exchange,
    issuePrice: 100,
    listingPrice: 110,
    source: 'InvestorGain',
    extra: {},
    ...extra,
  });

describe('Live market data for stored IPOs', () => {
  let close: () => Promise<void>;
  let requested: string[];

  beforeEach(async () => {
    ({ close } = await createTestDatabase());
    clearMarketDataCaches();
    clearSupabaseIpoCache();
    requested = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        requested.push(url);
        const ticker = decodeURIComponent(url.split('/chart/')[1].split('?')[0]);
        const body: Record<string, unknown> = {
          'SMEONE-SM.NS': chart(120, [100, 110, 115, 120], ['2026-10-07', '2026-10-08', '2026-11-26', '2026-11-27']),
          'MAINCO.NS': chart(205, [190, 200, 205], ['2026-11-25', '2026-11-26', '2026-11-27']),
        };
        return body[ticker]
          ? new Response(JSON.stringify(body[ticker]), { status: 200 })
          : new Response('{"chart":{"result":null}}', { status: 404 });
      })
    );
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await close();
  });

  it('finds the NSE SME ticker from the stored exchange and computes the day change', async () => {
    await seed('SMEONE', 'NSE SME');
    const q = (await getLiveQuote('SMEONE'))!;
    expect(q.ticker).toBe('SMEONE-SM.NS');
    expect(q.ltp).toBe(120);
    expect(q.previousClose).toBe(115);
    expect(q.change).toBe(5);
    expect(requested[0]).toContain('SMEONE-SM.NS');
  });

  it('returns null rather than a made-up price when the exchange has no data', async () => {
    await seed('GHOST', 'BSE SME');
    expect(await getLiveQuote('GHOST')).toBeNull();
    await expect(MarketService.getQuote('GHOST')).rejects.toThrow(/No live market data/);
    expect(await MarketService.getOhlc('GHOST', '1D')).toEqual([]);
  });

  it('charts only the trading since listing, with issue/listing price from Supabase', async () => {
    await seed('SMEONE', 'NSE SME');
    const c = (await getIpoChart('SMEONE', '3mo'))!;
    expect(c.points.map((p) => p.price)).toEqual([110, 115, 120]); // 2026-10-07 is before listing
    expect(c.issuePrice).toBe(100);
    expect(c.listingPrice).toBe(110);
    expect(c.gainVsIssuePct).toBe(20);
    expect(c.source).toBe('Yahoo Finance');
  });

  it('returns real daily candles', async () => {
    await seed('MAINCO', 'BSE, NSE');
    const candles = await getCandles('MAINCO', '1D');
    expect(candles.map((k) => k.close)).toEqual([190, 200, 205]);
  });

  it('quotes endpoint only serves listed IPOs (no open proxy)', async () => {
    await seed('MAINCO', 'BSE, NSE');
    const res = await quotesRoute(new Request('http://localhost/api/ipos/quotes?symbols=MAINCO,RELIANCE'));
    const json = await res.json();
    expect(Object.keys(json.quotes)).toEqual(['MAINCO']);
    expect(requested.some((u) => u.includes('RELIANCE'))).toBe(false);
    expect((await getLiveQuotes([])).constructor).toBe(Object);
  });
});
