import { fetchIpoDetail, type IgIpoDetail } from './investorgain';
import { ingestIgDetail } from './ipo-ingestion.service';
import { IpoRepository, todayIst, type IpoRecord } from '@/lib/repositories/ipo.repository';

/**
 * Keeps the IPOs people are watching fresh between scheduled syncs. When cards ask for live data,
 * any active IPO (open, opening soon, or closed but not yet listed) whose stored copy is older than
 * its freshness window is re-read from its InvestorGain page: subscription, GMP, dates, lot.
 *
 * Bounded: at most `maxPerCall` upstream requests per call, two at a time, one in flight per IPO.
 */

const inflight = new Map<string, Promise<boolean>>();

function nseOpen(now: Date): boolean {
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return ist.getUTCDay() >= 1 && ist.getUTCDay() <= 5 && mins >= 9 * 60 && mins <= 18 * 60;
}

/** Open, opening within 3 days, or closed and awaiting listing. */
export function isActive(r: Pick<IpoRecord, 'status' | 'openDate' | 'listingDate'>, now = new Date()): boolean {
  const today = todayIst(now);
  if (r.status === 'Open') return true;
  if (r.status === 'Upcoming') {
    if (!r.openDate) return false;
    const days = (new Date(`${r.openDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000;
    return days <= 3;
  }
  if (r.status === 'Closed') return !r.listingDate || r.listingDate >= today;
  return false;
}

/** How old a stored copy may be: 3 min for open issues in market hours, else 15 min. */
export function maxAgeMs(r: Pick<IpoRecord, 'status'>, now = new Date()): number {
  return r.status === 'Open' && nseOpen(now) ? 3 * 60_000 : 15 * 60_000;
}

export interface ActiveRefreshReport {
  active: number;
  stale: number;
  refreshed: string[];
  failed: string[];
}

export async function refreshActiveIpos(
  options: { symbols?: string[]; maxPerCall?: number; now?: Date; fetchDetail?: (id: number) => Promise<IgIpoDetail> } = {}
): Promise<ActiveRefreshReport> {
  const now = options.now ?? new Date();
  const fetchDetail = options.fetchDetail ?? fetchIpoDetail;
  const wanted = options.symbols?.length ? new Set(options.symbols.map((s) => s.toUpperCase())) : null;
  const all = await IpoRepository.listAll();
  const active = all.filter((r) => isActive(r, now) && (!wanted || wanted.has(r.symbol)) && typeof r.extra?.igId === 'number');
  const stale = active
    .filter((r) => !r.fetchedAt || now.getTime() - new Date(r.fetchedAt).getTime() > maxAgeMs(r, now))
    .sort((a, b) => (a.status === 'Open' ? -1 : 0) - (b.status === 'Open' ? -1 : 0))
    .slice(0, options.maxPerCall ?? 6);

  const report: ActiveRefreshReport = { active: active.length, stale: stale.length, refreshed: [], failed: [] };
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(2, stale.length) }, async () => {
      while (next < stale.length) {
        const rec = stale[next++];
        let job = inflight.get(rec.id);
        if (!job) {
          job = (async () => {
            try {
              await ingestIgDetail(await fetchDetail(rec.extra.igId as number));
              return true;
            } catch {
              return false;
            }
          })().finally(() => inflight.delete(rec.id));
          inflight.set(rec.id, job);
        }
        if (await job) report.refreshed.push(rec.symbol);
        else report.failed.push(rec.symbol);
      }
    })
  );
  return report;
}
