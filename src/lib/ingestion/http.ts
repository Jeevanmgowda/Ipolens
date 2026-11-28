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
  const mergedHeaders = new Headers(headers);
  if (!mergedHeaders.has('User-Agent')) mergedHeaders.set('User-Agent', BROWSER_UA);
  if (!mergedHeaders.has('Accept-Language')) mergedHeaders.set('Accept-Language', 'en-US,en;q=0.9');
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...rest,
        headers: mergedHeaders,
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
  const mergedHeaders = new Headers(init.headers);
  if (!mergedHeaders.has('Accept')) mergedHeaders.set('Accept', 'application/json');
  const text = await fetchText(source, url, { ...init, headers: mergedHeaders });
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') {
      throw new UpstreamError(source, `Unexpected JSON root from ${url}`);
    }
    return parsed as T;
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
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
