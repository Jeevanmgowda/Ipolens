import { NextRequest, NextResponse } from 'next/server';
import { safeGet } from '@/lib/security/safeFetch';

/**
 * Company logo proxy for IPO cards.
 * Hardened (docs/security/AUDIT_2026-11-27.md, ipo-logo follow-up):
 *  - every outbound request goes through safeGet (https only, private/metadata
 *    addresses blocked at DNS-lookup time, redirects re-validated, size and time caps);
 *  - symbol/name inputs and resolved domains are validated;
 *  - only raster images whose bytes match PNG/JPEG/GIF/WebP/ICO are served (no SVG),
 *    with a content type taken from the bytes and a sandboxing CSP;
 *  - the cache is bounded (LRU) with TTLs.
 */

const KNOWN_DOMAINS: Record<string, string> = {
  SWIGGY: 'swiggy.com',
  HYUNDAI: 'hyundai.com',
  BAJAJHFL: 'bajajhousingfinance.in',
  TATATECH: 'tatatechnologies.com',
  JIOFIN: 'jio.com',
  JIOPLAT: 'jio.com',
  IREDA: 'ireda.in',
  DOMS: 'domsindia.com',
  PREMIERENE: 'premierenergies.com',
  NETWEB: 'netwebindia.com',
  NTPCGREEN: 'ntpc.co.in',
  JYOTICNC: 'jyoti.co.in',
  KRN: 'krnheatexchanger.com',
  HDFP: 'hdfire.com',
  AIRPRO: 'airpro.in',
  FOODLINK: 'foodlink.in',
  WAAREEENER: 'waaree.com',
  VISHALMEGA: 'vishalmegamart.com',
  MOBIKWIK: 'mobikwik.com',
  FIRSTCRY: 'firstcry.com',
  OLAELEC: 'olaelectric.com',
  ZOMATO: 'zomato.com',
  PAYTM: 'paytm.com',
  NYKAA: 'nykaa.com',
  POLICYBZR: 'policybazaar.com',
  DELHIVERY: 'delhivery.com',
  LICI: 'licindia.in',
  SBFC: 'sbfc.com',
  TATAELXSI: 'tataelxsi.com',
  HONASA: 'mamaearth.in',
  SAGILITY: 'sagilityhealth.com',
  ACME: 'acme.in',
  ACMESOLAR: 'acme.in',
  AFCONS: 'afcons.com',
  NIVABUPA: 'nivabupa.com',
  ZINKA: 'blackbuck.com',
  BLACKBUCK: 'blackbuck.com',
  IKS: 'ikshealth.com',
  IGIL: 'igi.org',
  SAILIFE: 'sailife.com',
  DRAGARWAL: 'dragarwal.com',
  HEXAWARE: 'hexaware.com',
  ATHERENERG: 'atherenergy.com',
  SCHLOSS: 'theleela.com',
  BELRISE: 'belriseindustries.com',
  AEGISLOG: 'aegisindia.com',
  THELEELA: 'theleela.com',
};

const SYMBOL_RE = /^[A-Z0-9&._-]{1,20}$/;
const MAX_NAME_LENGTH = 120;
const DOMAIN_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const MAX_IMAGE_BYTES = 512 * 1024;
const MAX_HTML_BYTES = 512 * 1024;

interface CachedLogo {
  buffer: Buffer;
  contentType: string;
}

// Bounded LRU cache: arbitrary query strings must not grow memory without limit.
const CACHE_MAX_ENTRIES = 500;
const HIT_TTL_MS = 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 60 * 60 * 1000;
const logoCache = new Map<string, { logo: CachedLogo | null; expiresAt: number }>();

function cacheGet(key: string): { logo: CachedLogo | null } | undefined {
  const entry = logoCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    logoCache.delete(key);
    return undefined;
  }
  logoCache.delete(key); // refresh recency
  logoCache.set(key, entry);
  return entry;
}

function cacheSet(key: string, logo: CachedLogo | null): void {
  logoCache.delete(key);
  logoCache.set(key, { logo, expiresAt: Date.now() + (logo ? HIT_TTL_MS : MISS_TTL_MS) });
  while (logoCache.size > CACHE_MAX_ENTRIES) {
    const oldest = logoCache.keys().next().value;
    if (oldest === undefined) break;
    logoCache.delete(oldest);
  }
}

/** Image type from magic bytes; null for anything else (including SVG and HTML). */
function sniffImageType(buf: Buffer): string | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.subarray(0, 6).toString('latin1'))) return 'image/gif';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buf.length >= 4 && buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0) return 'image/x-icon';
  return null;
}

function cleanCompanyQuery(name: string): string {
  return name
    .replace(/\b(limited|ltd\.?|private|pvt\.?|ipo|india|industries|enterprises|holdings|corporation|corp\.?|inc\.?)\b/gi, ' ')
    .replace(/[()[\],.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function normalizeDomain(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const domain = value.trim().toLowerCase();
  return DOMAIN_RE.test(domain) ? domain : null;
}

async function fetchImage(url: string, timeoutMs = 2500): Promise<CachedLogo | null> {
  try {
    const res = await safeGet(url, { timeoutMs, maxBytes: MAX_IMAGE_BYTES, headers: { Accept: 'image/*' } });
    if (res.status < 200 || res.status >= 300 || res.body.length < 100) return null;
    const contentType = sniffImageType(res.body);
    return contentType ? { buffer: res.body, contentType } : null;
  } catch {
    return null;
  }
}

async function resolveDomain(symbol: string, companyName: string): Promise<string | null> {
  if (symbol && KNOWN_DOMAINS[symbol]) {
    return KNOWN_DOMAINS[symbol];
  }

  const query = cleanCompanyQuery(companyName || symbol);
  if (!query) return null;

  try {
    const res = await safeGet(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`, {
      timeoutMs: 2000,
      maxBytes: 64 * 1024,
      headers: { Accept: 'application/json' },
    });
    if (res.status !== 200) return null;
    const data = JSON.parse(res.body.toString('utf8')) as Array<{ name?: string; domain?: string }>;
    if (Array.isArray(data) && data.length > 0) {
      const domains = data.map((item) => normalizeDomain(item?.domain)).filter((d): d is string => Boolean(d));
      return domains.find((d) => d.endsWith('.in')) || domains[0] || null;
    }
  } catch {
    // Ignore lookup timeout/errors
  }
  return null;
}

function resolveCandidateUrl(rawUrl: string, baseUrl: string): string | null {
  try {
    const trimmed = rawUrl.trim();
    if (!trimmed || trimmed.startsWith('data:')) return null;
    const url = new URL(trimmed, baseUrl);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

async function extractHomepageLogo(domain: string): Promise<CachedLogo | null> {
  try {
    const res = await safeGet(`https://${domain}`, { timeoutMs: 2500, maxBytes: MAX_HTML_BYTES, headers: { Accept: 'text/html' } });
    if (res.status < 200 || res.status >= 300) return null;
    const html = res.body.toString('utf8');

    const candidates: string[] = [];
    for (const m of html.matchAll(/<link\b[^>]{0,2000}>/gi)) {
      const tag = m[0];
      const relMatch = tag.match(/rel=["']([^"']{1,100})["']/i);
      const hrefMatch = tag.match(/href=["']([^"']{1,2000})["']/i);
      if (!relMatch || !hrefMatch) continue;
      const rel = relMatch[1].toLowerCase();
      if (rel.includes('apple-touch-icon') || rel === 'icon' || rel === 'shortcut icon') {
        const resolved = resolveCandidateUrl(hrefMatch[1], res.finalUrl);
        if (resolved && !/\.svg(\?|$)/i.test(resolved)) {
          if (rel.includes('apple-touch-icon')) candidates.unshift(resolved);
          else candidates.push(resolved);
        }
      }
    }

    const ogMatch =
      html.match(/<meta\b[^>]{0,2000}property=["']og:image["'][^>]{0,2000}content=["']([^"']{1,2000})["']/i) ||
      html.match(/<meta\b[^>]{0,2000}content=["']([^"']{1,2000})["'][^>]{0,2000}property=["']og:image["']/i);
    if (ogMatch?.[1]) {
      const resolved = resolveCandidateUrl(ogMatch[1], res.finalUrl);
      if (resolved) candidates.push(resolved);
    }

    for (const candidateUrl of candidates.slice(0, 4)) {
      const img = await fetchImage(candidateUrl, 2000);
      if (img) return img;
    }
  } catch {
    // Ignore unreachable homepages
  }
  return null;
}

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=3600' } });
}

function imageResponse(logo: CachedLogo): NextResponse {
  return new NextResponse(new Uint8Array(logo.buffer), {
    status: 200,
    headers: {
      'Content-Type': logo.contentType,
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') || '').trim().toUpperCase();
  const name = (searchParams.get('name') || '').trim();

  if ((!symbol && !name) || (symbol && !SYMBOL_RE.test(symbol)) || name.length > MAX_NAME_LENGTH || /[\u0000-\u001f]/.test(name)) {
    return new NextResponse(null, { status: 400 });
  }

  const cacheKey = `${symbol}:${name.toLowerCase()}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return cached.logo ? imageResponse(cached.logo) : notFound();
  }

  const domain = await resolveDomain(symbol, name);
  let logo: CachedLogo | null = null;

  if (domain) {
    const logoDevToken = process.env.LOGO_DEV_TOKEN;
    if (logoDevToken) {
      logo = await fetchImage(`https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(logoDevToken)}&size=128`);
    }
    if (!logo) {
      logo = await extractHomepageLogo(domain);
    }
    if (!logo) {
      logo = await fetchImage(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`);
    }
  }

  cacheSet(cacheKey, logo);
  return logo ? imageResponse(logo) : notFound();
}
