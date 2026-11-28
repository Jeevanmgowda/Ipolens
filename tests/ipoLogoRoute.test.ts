import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * /api/ipo-logo hardening (docs/security/AUDIT_2026-11-27.md, ipo-logo follow-up).
 * The SSRF-safe fetcher is mocked so no network is used.
 */

const safeGet = vi.fn();
vi.mock('@/lib/security/safeFetch', () => ({ safeGet: (...args: unknown[]) => safeGet(...args) }));

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]);
const SVG = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.domain)</script>${' '.repeat(200)}</svg>`);

const get = async (query: string) => {
  const { GET } = await import('@/app/api/ipo-logo/route');
  return GET(new NextRequest(`http://localhost/api/ipo-logo?${query}`));
};

beforeEach(() => {
  safeGet.mockReset();
});

describe('/api/ipo-logo', () => {
  it('rejects missing, malformed or oversized input with 400', async () => {
    expect((await get('')).status).toBe(400);
    expect((await get('symbol=%3Cscript%3E')).status).toBe(400);
    expect((await get(`name=${'a'.repeat(121)}`)).status).toBe(400);
    expect((await get('name=abc%0Adef')).status).toBe(400);
    expect(safeGet).not.toHaveBeenCalled();
  });

  it('serves a real raster image with a content type taken from its bytes and a sandbox CSP', async () => {
    safeGet.mockResolvedValue({ status: 200, contentType: 'text/html', body: PNG, finalUrl: 'https://swiggy.com/' });
    const res = await get('symbol=SWIGGY');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('content-security-policy')).toContain('sandbox');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('never serves SVG or HTML, even when labelled as an image', async () => {
    safeGet.mockResolvedValue({ status: 200, contentType: 'image/svg+xml', body: SVG, finalUrl: 'https://zomato.com/' });
    expect((await get('symbol=ZOMATO')).status).toBe(404);
  });

  it('ignores invalid domains returned by the company lookup', async () => {
    safeGet.mockImplementation(async (url: string) => {
      if (url.startsWith('https://autocomplete.clearbit.com/')) {
        return { status: 200, contentType: 'application/json', body: Buffer.from(JSON.stringify([{ domain: '169.254.169.254' }, { domain: 'evil.com:8080/x' }])), finalUrl: url };
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    expect((await get('name=Unknown%20Holdings%20Ltd')).status).toBe(404);
    expect(safeGet).toHaveBeenCalledTimes(1);
  });

  it('keeps the cache bounded: old entries are evicted, recent ones are served from cache', async () => {
    safeGet.mockResolvedValue({ status: 404, contentType: 'text/html', body: Buffer.alloc(0), finalUrl: 'https://x.example/' });
    for (let i = 0; i < 600; i++) await get(`name=Company${i}`);
    safeGet.mockClear();

    await get('name=Company599'); // recent: cached
    expect(safeGet).not.toHaveBeenCalled();

    await get('name=Company0'); // oldest: evicted, fetched again
    expect(safeGet).toHaveBeenCalled();
  });
});
