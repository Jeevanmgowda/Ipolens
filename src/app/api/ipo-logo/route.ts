import { NextRequest, NextResponse } from 'next/server';
import { isSafePublicHost } from '@/lib/security/publicHost';

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

interface CachedLogo {
  buffer: ArrayBuffer;
  contentType: string;
}

const logoCache = new Map<string, CachedLogo | null>();
const MAX_CACHE_ENTRIES = 2000;

/** Third-party images (SVG can carry script) are served inert from our origin. */
const IMAGE_SAFETY_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  'X-Content-Type-Options': 'nosniff',
};

function cacheLogo(key: string, logo: CachedLogo | null): void {
  if (logoCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = logoCache.keys().next().value;
    if (oldest !== undefined) logoCache.delete(oldest);
  }
  logoCache.set(key, logo);
}

/** Same site as the company domain (the domain itself or a subdomain), https only. */
function sameSiteHttps(url: string, domain: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const base = domain.toLowerCase().replace(/^www\./, '');
    return u.protocol === 'https:' && isSafePublicHost(host) && (host === base || host.endsWith(`.${base}`));
  } catch {
    return false;
  }
}

function cleanCompanyQuery(name: string): string {
  return name
    .replace(/\b(limited|ltd\.?|private|pvt\.?|ipo|india|industries|enterprises|holdings|corporation|corp\.?|inc\.?)\b/gi, ' ')
    .replace(/[()[\],.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchImageWithTimeout(url: string, timeoutMs = 2500): Promise<CachedLogo | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'image/*' },
      redirect: 'error', // a redirect could point anywhere; never follow it
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 100 || buffer.byteLength > 512 * 1024) return null;
    return { buffer, contentType };
  } catch {
    return null;
  }
}

async function resolveDomain(symbol: string, companyName: string): Promise<string | null> {
  const sym = symbol.toUpperCase().trim();
  if (KNOWN_DOMAINS[sym]) {
    return KNOWN_DOMAINS[sym];
  }

  const query = cleanCompanyQuery(companyName || symbol);
  if (!query) return null;

  try {
    const res = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(2000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ name?: string; domain?: string }>;
    if (Array.isArray(data) && data.length > 0) {
      const safe = data.filter((item) => typeof item?.domain === 'string' && isSafePublicHost(item.domain));
      const indianMatch = safe.find((item) => /\.in$/i.test(item.domain!));
      return indianMatch?.domain || safe[0]?.domain || null;
    }
  } catch {
    // Ignore lookup timeout/errors
  }
  return null;
}

function resolveCandidateUrl(rawUrl: string, baseOrigin: string): string | null {
  try {
    const trimmed = rawUrl.trim();
    if (!trimmed || trimmed.startsWith('data:')) return null;
    return new URL(trimmed, baseOrigin).toString();
  } catch {
    return null;
  }
}

async function extractHomepageLogo(domain: string): Promise<CachedLogo | null> {
  if (!isSafePublicHost(domain)) return null;
  let baseOrigin = `https://${domain}`;
  try {
    // Follow at most 3 redirects by hand, each one checked to stay on the company's own site.
    let res: Response | null = null;
    for (let hop = 0; hop < 4; hop++) {
      res = await fetch(baseOrigin, {
        signal: AbortSignal.timeout(2500),
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; IPOLENS/1.0)',
          Accept: 'text/html',
        },
      });
      const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
      if (!location) break;
      const next = new URL(location, baseOrigin).toString();
      if (!sameSiteHttps(next, domain)) return null;
      baseOrigin = next;
      res = null;
    }
    if (!res || !res.ok) return null;
    const html = (await res.text()).slice(0, 120_000);

    const candidates: string[] = [];
    const linkMatches = html.matchAll(/<link\b[^>]*>/gi);
    for (const m of linkMatches) {
      const tag = m[0];
      const relMatch = tag.match(/rel=["']([^"']+)["']/i);
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
      if (!relMatch || !hrefMatch) continue;
      const rel = relMatch[1].toLowerCase();
      if (rel.includes('apple-touch-icon') || rel === 'icon' || rel === 'shortcut icon') {
        const resolved = resolveCandidateUrl(hrefMatch[1], baseOrigin);
        if (resolved) {
          if (rel.includes('apple-touch-icon') || /\.svg(\?|$)/i.test(resolved)) {
            candidates.unshift(resolved);
          } else {
            candidates.push(resolved);
          }
        }
      }
    }

    const ogMatch =
      html.match(/<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogMatch?.[1]) {
      const resolved = resolveCandidateUrl(ogMatch[1], baseOrigin);
      if (resolved) candidates.push(resolved);
    }

    for (const candidateUrl of candidates.filter((c) => sameSiteHttps(c, domain)).slice(0, 4)) {
      const img = await fetchImageWithTimeout(candidateUrl, 2000);
      if (img) return img;
    }
  } catch {
    // Ignore unreachable homepages
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') || '').trim().toUpperCase().slice(0, 32);
  const name = (searchParams.get('name') || '').trim().slice(0, 160);

  if (!symbol && !name) {
    return new NextResponse(null, { status: 400 });
  }

  const cacheKey = `${symbol}:${name.toLowerCase()}`;
  if (logoCache.has(cacheKey)) {
    const cached = logoCache.get(cacheKey);
    if (!cached) {
      return new NextResponse(null, {
        status: 404,
        headers: { 'Cache-Control': 'public, max-age=3600' },
      });
    }
    return new NextResponse(cached.buffer, {
      status: 200,
      headers: {
        'Content-Type': cached.contentType,
        'Cache-Control': 'public, max-age=86400',
        ...IMAGE_SAFETY_HEADERS,
      },
    });
  }

  const domain = await resolveDomain(symbol, name);
  let logo: CachedLogo | null = null;

  if (domain) {
    const logoDevToken = process.env.LOGO_DEV_TOKEN;
    if (logoDevToken) {
      logo = await fetchImageWithTimeout(
        `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(logoDevToken)}&size=128`
      );
    }
    if (!logo) {
      logo = await extractHomepageLogo(domain);
    }
    if (!logo) {
      logo = await fetchImageWithTimeout(
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
      );
    }
  }

  cacheLogo(cacheKey, logo);

  if (!logo) {
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'public, max-age=3600' },
    });
  }

  return new NextResponse(logo.buffer, {
    status: 200,
    headers: {
      'Content-Type': logo.contentType,
      'Cache-Control': 'public, max-age=86400',
      ...IMAGE_SAFETY_HEADERS,
    },
  });
}
