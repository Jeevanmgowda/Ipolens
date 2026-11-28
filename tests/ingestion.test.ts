import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseReportRow, extractDetailPayload, parseDetailPayload } from '@/lib/ingestion/investorgain';
import { parseBseIssue, normalizeCompanyName } from '@/lib/ingestion/bse';
import { detailToUpsert, ingestIgDetail, deriveSymbol } from '@/lib/ingestion/ipo-ingestion.service';
import { IpoRepository, deriveStatus } from '@/lib/repositories/ipo.repository';
import { resolveRegistrarSlug } from '@/lib/registrars';
import { createTestDatabase } from './helpers/testDb';

const fx = (f: string) => fs.readFileSync(path.join(__dirname, 'fixtures/ingestion', f), 'utf8');

describe('InvestorGain parsers (real captured responses)', () => {
  it('parses live report rows with GMP, subscription, dates and listing price', () => {
    const rows = JSON.parse(fx('investorgain-report.json')).reportTableData.map(parseReportRow).filter(Boolean);
    expect(rows.length).toBeGreaterThan(3);
    for (const r of rows) {
      expect(r.igId).toBeGreaterThan(0);
      expect(r.name.length).toBeGreaterThan(2);
      // Upcoming issues can legitimately have no dates yet; then the value is null, never invented.
      if (r.openDate !== null) expect(r.openDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const listed = rows.find((r: { statusCode: string; listingPrice: number | null }) => r.statusCode.startsWith('L') && r.listingPrice !== null);
    expect(listed).toBeDefined();
  });

  it('extracts the embedded detail payload and normalises it', () => {
    const payload = extractDetailPayload(fx('investorgain-detail-open.html'));
    expect(payload).not.toBeNull();
    const d = parseDetailPayload(payload!)!;
    expect(d.igId).toBe(1810);
    expect(d.nseSymbol).toBe('FOODLINK');
    expect(d.priceLow).toBe(181);
    expect(d.priceHigh).toBe(191);
    expect(d.lotSize).toBe(78);
    expect(d.freshIssueCr).toBeCloseTo(192, 0);
    expect(d.ofsCr).toBeCloseTo(168.76, 1);
    expect(d.allotmentDate).toBe('2026-12-01');
    expect(d.listingDate).toBe('2026-12-03');
    expect(d.registrarName).toMatch(/MUFG Intime/);
    expect(d.rhpUrl).toMatch(/^https:\/\/www\.bseindia\.com\/.+\.pdf$/);
    expect(d.drhpUrl).toMatch(/sebi\.gov\.in/);
    expect(d.gmpHistory.length).toBeGreaterThan(0);
    expect(d.bids?.total).toBeGreaterThan(0);
  });

  it('parses a listed IPO with a listing price', () => {
    const d = parseDetailPayload(extractDetailPayload(fx('investorgain-detail-listed.html'))!)!;
    expect(d.igId).toBe(1635);
    expect(d.listingPrice).toBeGreaterThan(0);
  });

  it('returns null for pages without a payload', () => {
    expect(extractDetailPayload('<html>no data</html>')).toBeNull();
  });
});

describe('BSE public issues', () => {
  it('parses price band, dates and status', () => {
    const issues = JSON.parse(fx('bse-public-issues.json')).Table.map(parseBseIssue);
    expect(issues.length).toBeGreaterThan(0);
    for (const i of issues) {
      expect(i.scripCode).toBeGreaterThan(0);
      expect(['live', 'forthcoming', 'closed', 'other']).toContain(i.status);
      if (i.priceHigh !== null) expect(i.priceHigh).toBeGreaterThanOrEqual(i.priceLow ?? 0);
    }
  });

  it('normalises company names for matching', () => {
    expect(normalizeCompanyName('Foodlink F&B Holdings (India) Limited')).toBe('foodlink f b holdings india');
  });
});

describe('Registrar resolution', () => {
  it('maps names, emails and websites to slugs', () => {
    expect(resolveRegistrarSlug('MUFG Intime India Pvt.Ltd.')).toBe('linkintime');
    expect(resolveRegistrarSlug(null, 'x.ipo@in.mpms.mufg.com')).toBe('linkintime');
    expect(resolveRegistrarSlug('KFin Technologies Ltd.')).toBe('kfintech');
    expect(resolveRegistrarSlug('Bigshare Services Pvt.Ltd.')).toBe('bigshare');
    expect(resolveRegistrarSlug('Unknown RTA')).toBe('other');
  });
});

describe('Lifecycle status from the issue calendar', () => {
  const at = (iso: string) => new Date(`${iso}T06:00:00Z`);
  const base = { openDate: '2026-11-26', closeDate: '2026-11-30', listingDate: '2026-12-03', listingPrice: null };
  it('derives upcoming, open, closed and listed', () => {
    expect(deriveStatus(base, at('2026-11-20'))).toBe('Upcoming');
    expect(deriveStatus(base, at('2026-11-27'))).toBe('Open');
    expect(deriveStatus(base, at('2026-12-01'))).toBe('Closed');
    expect(deriveStatus(base, at('2026-12-03'))).toBe('Listed');
    expect(deriveStatus({ ...base, listingPrice: 200 }, at('2026-11-27'))).toBe('Listed');
  });
});

describe('Ingestion into Postgres (PGlite)', () => {
  let close: () => Promise<void>;
  beforeEach(async () => {
    ({ close } = await createTestDatabase());
  });
  afterEach(async () => close());

  it('upserts the IPO, subscription and GMP history, and builds the API view with nulls not defaults', async () => {
    const detail = parseDetailPayload(extractDetailPayload(fx('investorgain-detail-open.html'))!)!;
    const { gmpPoints } = await ingestIgDetail(detail);
    expect(gmpPoints).toBe(detail.gmpHistory.length);

    // Re-ingesting is idempotent for GMP points.
    expect((await ingestIgDetail(detail)).gmpPoints).toBe(0);

    const [view] = await IpoRepository.listView({ symbols: ['FOODLINK'] });
    expect(view.symbol).toBe('FOODLINK');
    expect(view.registrarSlug).toBe('linkintime');
    expect(view.lotSize).toBe(78);
    expect(view.ofsPercent).toBeGreaterThan(40);
    expect(view.gmpSource).toBe('InvestorGain');
    expect(view.currentSubscription).toBeGreaterThan(0);
    expect(view.aiGmp).toBeNull();
    expect(view.rhpUrl).toBe(detail.rhpUrl);
  });

  it('reconciles the later live report GMP reading over the earlier detail reading for the same date', async () => {
    const reportRows = JSON.parse(fx('investorgain-report.json')).reportTableData.map(parseReportRow).filter(Boolean);
    const detail = parseDetailPayload(extractDetailPayload(fx('investorgain-detail-open.html'))!)!;
    const row = reportRows.find((r: { igId: number }) => r.igId === detail.igId);
    expect(row).toBeDefined();
    expect(row.gmp).toBe(4);

    await ingestIgDetail(detail, row);
    const history = await IpoRepository.gmpHistory('FOODLINK');
    const nov27 = history.find((h) => h.date === '2026-11-27');
    expect(nov27?.gmp).toBe(4);
  });

  it('moves applications when the symbol changes', async () => {
    const detail = parseDetailPayload(extractDetailPayload(fx('investorgain-detail-open.html'))!)!;
    const noSymbol = { ...detail, nseSymbol: null };
    await IpoRepository.upsert(detailToUpsert(noSymbol));
    expect(deriveSymbol(noSymbol)).toBe('FOODLINKFBHOLDINGS');
    await IpoRepository.upsert(detailToUpsert(detail));
    expect(await IpoRepository.getBySymbol('FOODLINK')).not.toBeNull();
    expect(await IpoRepository.getBySymbol('FOODLINKFBHOLDINGS')).toBeNull();
  });
});
