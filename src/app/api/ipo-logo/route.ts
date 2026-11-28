import { NextRequest, NextResponse } from 'next/server';

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
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 100) return null;
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
      const indianMatch = data.find((item) => item?.domain && /\.in$/i.test(item.domain));
      return indianMatch?.domain || data[0]?.domain || null;
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
  const baseOrigin = `https://${domain}`;
  try {
    const res = await fetch(baseOrigin, {
      signal: AbortSignal.timeout(2500),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IPOLENS/1.0)',
        Accept: 'text/html',
      },
    });
    if (!res.ok) return null;
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

    for (const candidateUrl of candidates.slice(0, 4)) {
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
  const symbol = (searchParams.get('symbol') || '').trim().toUpperCase();
  const name = (searchParams.get('name') || '').trim();

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

  logoCache.set(cacheKey, logo);

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
    },
  });
}
