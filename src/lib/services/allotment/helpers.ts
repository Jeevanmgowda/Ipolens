import { hashPan, isValidPan, maskPan, normalizePan } from '@/lib/security/panEncryption';
import { ADAPTER_TIMEOUT_MS } from './config';
import type { AdapterOutcome, AllotmentErrorCode } from './types';

export { hashPan, isValidPan, maskPan, normalizePan };

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export class AdapterHttpError extends Error {
  constructor(public readonly code: AllotmentErrorCode, message: string, public readonly status?: number) {
    super(message);
    this.name = 'AdapterHttpError';
  }
}

/** fetch with a hard timeout; maps aborts and non-2xx responses to typed adapter errors. */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = ADAPTER_TIMEOUT_MS): Promise<Response> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store', redirect: 'follow' });
    if (!res.ok) throw new AdapterHttpError('HTTP_ERROR', `HTTP ${res.status}`, res.status);
    return res;
  } catch (err) {
    if (err instanceof AdapterHttpError) throw err;
    const name = (err as Error)?.name;
    if (name === 'TimeoutError' || name === 'AbortError') throw new AdapterHttpError('TIMEOUT', 'Registrar timed out');
    throw new AdapterHttpError('HTTP_ERROR', (err as Error)?.message || 'Network error');
  }
}

/** Reads a JSON body, rejecting HTML/CAPTCHA pages. Handles ASP.NET `{ d: "<json string>" }` wrappers. */
export async function readJsonPayload(res: Response): Promise<unknown> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) throw new AdapterHttpError('MALFORMED_RESPONSE', 'Empty response');
  if (trimmed.startsWith('<') || /captcha|recaptcha|cf-chl|access denied/i.test(trimmed.slice(0, 2000))) {
    throw new AdapterHttpError('CAPTCHA_OR_HTML', 'Registrar returned an HTML or CAPTCHA page');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new AdapterHttpError('MALFORMED_RESPONSE', 'Response was not valid JSON');
  }
  return unwrap(parsed);
}

function unwrap(value: unknown): unknown {
  if (value && typeof value === 'object' && 'd' in (value as Record<string, unknown>)) {
    return unwrap((value as Record<string, unknown>).d);
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        return unwrap(JSON.parse(s));
      } catch {
        return value;
      }
    }
    if (s.startsWith('<')) return parseXmlRows(s);
  }
  return value;
}

/** Minimal parser for ASP.NET DataSet XML: <Table><Field>v</Field></Table> -> [{field: v}]. */
export function parseXmlRows(xml: string): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];
  const tableRe = /<Table\d*>([\s\S]*?)<\/Table\d*>/gi;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(xml))) {
    const row: Record<string, string> = {};
    const fieldRe = /<([A-Za-z_][\w.-]*)>([\s\S]*?)<\/\1>/g;
    let f: RegExpExecArray | null;
    while ((f = fieldRe.exec(m[1]))) row[f[1].toLowerCase()] = f[2].trim();
    rows.push(row);
  }
  return rows;
}

/** Finds the first record-like object in a payload (array, {data: [...]}, {Table: [...]}). */
export function firstRecord(payload: unknown): Record<string, unknown> | null {
  if (Array.isArray(payload)) return (payload.find((r) => r && typeof r === 'object') as Record<string, unknown>) ?? null;
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    for (const key of ['data', 'Data', 'Table', 'table', 'result', 'Result', 'records']) {
      if (key in obj) return firstRecord(obj[key]);
    }
    return obj;
  }
  return null;
}

export function pickField(rec: Record<string, unknown>, names: readonly string[]): unknown {
  const lower = new Map(Object.entries(rec).map(([k, v]) => [k.toLowerCase().replace(/\s+/g, '_'), v]));
  for (const n of names) if (lower.has(n)) return lower.get(n);
  return undefined;
}

export function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

/** Shared normalisation: shares > 0 -> ALLOTTED, 0 or empty record -> NOT_ALLOTTED. */
export function normalizeRecord(
  payload: unknown,
  fields: { allotted: readonly string[]; applied: readonly string[]; applicationNo: readonly string[]; dpId: readonly string[] }
): AdapterOutcome {
  const rec = firstRecord(payload);
  const isEmpty = !rec || Object.keys(rec).length === 0 || (Array.isArray(payload) && payload.length === 0);
  if (isEmpty) return { status: 'NOT_ALLOTTED', sharesAllotted: 0, message: 'No allotment record for this PAN.' };

  const allotted = toInt(pickField(rec!, fields.allotted));
  if (allotted === null) {
    const text = JSON.stringify(rec).toLowerCase();
    if (/not\s*allot|non[-\s]*allot|no record|invalid pan|not found/.test(text)) {
      return { status: 'NOT_ALLOTTED', sharesAllotted: 0, message: 'Registrar reports no allotment for this PAN.' };
    }
    throw new AdapterHttpError('MALFORMED_RESPONSE', 'Allotted share count not found in registrar response');
  }
  const applicationNumber = pickField(rec!, fields.applicationNo);
  const dpId = pickField(rec!, fields.dpId);
  return {
    status: allotted > 0 ? 'ALLOTTED' : 'NOT_ALLOTTED',
    sharesAllotted: Math.max(0, allotted),
    sharesApplied: toInt(pickField(rec!, fields.applied)) ?? undefined,
    applicationNumber: applicationNumber ? String(applicationNumber) : undefined,
    dpId: dpId ? String(dpId) : undefined,
    message: allotted > 0 ? `${allotted} shares allotted.` : 'Not allotted.',
  };
}

export function manualOutcome(code: AllotmentErrorCode, message: string): AdapterOutcome {
  return { status: 'MANUAL_VERIFICATION_REQUIRED', errorCode: code, message };
}

export const cacheKey = (symbol: string, panHash: string) => `allotment:${symbol.toUpperCase()}:${panHash}`;
export const lockKey = (symbol: string, panHash: string) => `allotment:lock:${symbol.toUpperCase()}:${panHash}`;
export const breakerKey = (slug: string) => `allotment:breaker:${slug}`;

/** Fuzzy company match for registrar company lists ("Foodlink F&B Holdings (India) Ltd"). */
export function companyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(limited|ltd|private|pvt|india|ipo|sme)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
