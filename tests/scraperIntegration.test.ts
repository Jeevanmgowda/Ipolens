import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { IpoFetchService } from '@/services/ipoFetchService';
import { GET } from '@/app/api/scraper/sync/route';

describe('Python Scraper Integration Pipeline', () => {
  it('should verify that all Python scraper scripts exist in scripts/scraper/', () => {
    const scraperDir = path.resolve(process.cwd(), 'scripts', 'scraper');
    expect(fs.existsSync(scraperDir)).toBe(true);

    const requiredFiles = ['bse.py', 'common.py', 'gmp.py', 'merge.py', 'nse.py', 'requirements.txt'];
    for (const file of requiredFiles) {
      const filePath = path.join(scraperDir, file);
      expect(fs.existsSync(filePath), `Expected ${file} to exist in scripts/scraper`).toBe(true);
    }
  });

  it('should verify package.json has dedicated scrape npm scripts', () => {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts['scrape']).toBe('python scripts/scraper/merge.py');
    expect(pkg.scripts['scrape:nse']).toBe('python scripts/scraper/nse.py');
    expect(pkg.scripts['scrape:bse']).toBe('python scripts/scraper/bse.py');
    expect(pkg.scripts['scrape:gmp']).toBe('python scripts/scraper/gmp.py');
  });

  it('should parse scraped data feed from disk into valid MergedIpoRecords', () => {
    // Write temporary test fixture to verify parsing logic
    const testIpoFeed = {
      generatedAt: '2026-11-09T04:00:00Z',
      totalCount: 2,
      ipos: [
        {
          symbol: 'TESTSME',
          companyName: 'Test SME Enterprises Limited',
          normalizedName: 'test sme enterprises',
          platform: 'SME',
          series: 'SME',
          exchanges: ['NSE', 'BSE'],
          status: 'open',
          openDate: '2026-11-01',
          closeDate: '2026-11-05',
          priceBand: { min: 100, max: 105 },
          lotSize: 1200,
          gmp: { value: 25, percent: 23.8 },
          subscriptionTimes: '12.5x',
        },
        {
          symbol: 'TESTMAIN',
          companyName: 'Test Mainboard Tech Limited',
          normalizedName: 'test mainboard tech',
          platform: 'Mainboard',
          series: 'EQ',
          exchanges: ['NSE'],
          status: 'upcoming',
          openDate: '2026-11-15',
          closeDate: '2026-11-18',
          priceBand: { min: 450, max: 475 },
          lotSize: 30,
          gmp: { value: 80, percent: 16.8 },
        },
      ],
    };

    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const iposJsonPath = path.join(dataDir, 'ipos.json');

    // Save existing content if any
    const priorContent = fs.existsSync(iposJsonPath) ? fs.readFileSync(iposJsonPath, 'utf-8') : null;

    try {
      fs.writeFileSync(iposJsonPath, JSON.stringify(testIpoFeed, null, 2), 'utf-8');

      const parsed = IpoFetchService.loadDiskScrapedFeed();
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);

      const sme = parsed.find((p) => p.symbol === 'TESTSME');
      expect(sme).toBeDefined();
      expect(sme?.platform).toBe('SME');
      expect(sme?.series).toBe('SME');
      expect(sme?.status).toBe('Active');
      expect(sme?.gmp?.value).toBe(25);
      expect(sme?.lotSize).toBe(1200);

      const main = parsed.find((p) => p.symbol === 'TESTMAIN');
      expect(main).toBeDefined();
      expect(main?.platform).toBe('Mainboard');
      expect(main?.series).toBe('EQ');
      expect(main?.status).toBe('Forthcoming');
    } finally {
      // Restore previous state
      if (priorContent !== null) {
        fs.writeFileSync(iposJsonPath, priorContent, 'utf-8');
      }
    }
  });

  it('should respond with scraper status from /api/scraper/sync route', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toBeDefined();
    expect(typeof json.exists).toBe('boolean');
    expect(Array.isArray(json.sources)).toBe(true);
    expect(json.sources).toContain('NSE India (Official Exchange)');
    expect(json.sources).toContain('BSE India (Official Exchange)');
  });
});

