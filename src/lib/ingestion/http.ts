/** Shared HTTP helper for ingestion: browser-like headers, hard timeout, small retry budget. */

export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export class UpstreamError extends Error {
  constructor(public readonly source: string, message: string, public readonly status?: number) {
    super(`[${source}] ${message}`);
    this.name = 'UpstreamError';
  }
}

export async function fetchText(
  source: string,
  url: string,
  init: RequestInit & { timeoutMs?: number; retries?: number } = {}
): Promise<string> {
  const { timeoutMs = 15000, retries = 2, headers, ...rest } = init;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...rest,
        headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9', ...headers },
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      });
      if (!res.ok) throw new UpstreamError(source, `HTTP ${res.status} for ${url}`, res.status);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (err instanceof UpstreamError && err.status && err.status < 500 && err.status !== 429) break;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  if (lastErr instanceof UpstreamError) throw lastErr;
  throw new UpstreamError(source, (lastErr as Error)?.message || 'request failed');
}

export async function fetchJson<T>(source: string, url: string, init: Parameters<typeof fetchText>[2] = {}): Promise<T> {
  const text = await fetchText(source, url, { ...init, headers: { Accept: 'application/json', ...init.headers } });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new UpstreamError(source, `Non-JSON response from ${url}`);
  }
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#8377;/g, '₹')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parses numbers such as "₹360.76 Cr", "1,14,29,496", "5.51x"; returns null for "--" or blanks. */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = stripHtml(String(value)).replace(/[^0-9.\-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
