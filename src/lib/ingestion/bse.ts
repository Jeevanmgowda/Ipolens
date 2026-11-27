import { fetchJson, toNumber } from './http';

/** BSE public-issue list (official exchange data; MainBoard and SME, live + forthcoming). */

export interface BseIssue {
  scripCode: number;
  name: string;
  openDate: string | null;
  closeDate: string | null;
  priceLow: number | null;
  priceHigh: number | null;
  faceValue: number | null;
  status: 'live' | 'forthcoming' | 'closed' | 'other';
  platform: 'MainBoard' | 'SME' | string;
  detailUrl: string | null;
}

export function parseBseIssue(r: Record<string, unknown>): BseIssue {
  const [low, high] = String(r.Price_Band || '')
    .split('-')
    .map((p) => toNumber(p));
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  const status = r.Status === 'L' ? 'live' : r.Status === 'F' ? 'forthcoming' : r.Status === 'C' ? 'closed' : 'other';
  return {
    scripCode: Number(r.Scrip_cd),
    name: str(r.Scrip_Name).trim(),
    openDate: r.Start_Dt ? str(r.Start_Dt).slice(0, 10) : null,
    closeDate: r.End_Dt ? str(r.End_Dt).slice(0, 10) : null,
    priceLow: low ?? null,
    priceHigh: high ?? low ?? null,
    faceValue: toNumber(r.Face_Val),
    status,
    platform: str(r.eXCHANGE_PLATFORM) || 'MainBoard',
    detailUrl: r.navigate_url ? str(r.navigate_url) : null,
  };
}

export async function fetchBsePublicIssues(): Promise<BseIssue[]> {
  const data = await fetchJson<{ Table?: Record<string, unknown>[] }>(
    'BSE',
    'https://api.bseindia.com/BseIndiaAPI/api/GetPublicIssue_par_updated/w?flag=1&status=&exchange=&ir_flag=IPO',
    { headers: { Referer: 'https://www.bseindia.com/' } }
  );
  return (data.Table || []).map(parseBseIssue);
}

/** Normalises company names for cross-source matching ("Foodlink F&B Holdings (India) Ltd." -> "foodlink f b holdings india"). */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(limited|ltd|private|pvt|inc|llp)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
