import { fetchIpoDetail, type IgIpoDetail } from './investorgain';
import { UpstreamError } from './http';
import { ingestIgDetail } from './ipo-ingestion.service';
import { IpoRepository, todayIst } from '@/lib/repositories/ipo.repository';

/**
 * 12-month InvestorGain backfill. InvestorGain numbers IPO detail pages with increasing ids, so
 * the backfill walks ids downward from the newest one stored, one request per second.
 *
 * It is resumable without extra state: ids already stored from InvestorGain are skipped without
 * a request, so calling it again with the returned `nextId` (or with no cursor) continues where
 * it stopped. Each call does a bounded batch so it fits inside a request timeout.
 *
 * Ids are assigned when a DRHP is first listed, so they are not strictly ordered by open date.
 * The walk therefore stops only after `stopAfterOld` consecutive IPOs older than the window.
 */

export interface BackfillOptions {
  fromId?: number;
  maxRequests?: number;
  months?: number;
  delayMs?: number;
  stopAfterOld?: number;
  stopAfterMisses?: number;
  /** Test seam. */
  fetchDetail?: (id: number) => Promise<IgIpoDetail>;
}

export interface BackfillReport {
  fromId: number;
  nextId: number;
  done: boolean;
  doneReason: string | null;
  requests: number;
  ingested: number;
  skippedKnown: number;
  olderThanWindow: number;
  misses: number;
  gmpPointsAdded: number;
  cutoffDate: string;
  errors: string[];
}

function cutoffFor(months: number, now = new Date()): string {
  const d = new Date(`${todayIst(now)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

export async function runBackfill(options: BackfillOptions = {}): Promise<BackfillReport> {
  const months = Math.min(24, Math.max(1, options.months ?? 12));
  const maxRequests = Math.min(120, Math.max(1, options.maxRequests ?? 45));
  const delayMs = options.delayMs ?? 1000;
  const stopAfterOld = options.stopAfterOld ?? 30;
  const stopAfterMisses = options.stopAfterMisses ?? 40;
  const fetchDetail = options.fetchDetail ?? fetchIpoDetail;
  const cutoffDate = cutoffFor(months);

  const stored = await IpoRepository.listAll();
  const knownIds = new Set(
    stored.map((r) => r.extra?.igId).filter((n): n is number => typeof n === 'number' && n > 0)
  );
  const fromId = options.fromId ?? (knownIds.size ? Math.max(...knownIds) : 0);
  if (!fromId) {
    return {
      fromId: 0,
      nextId: 0,
      done: true,
      doneReason: 'No InvestorGain ids stored yet. Run the live sync first.',
      requests: 0,
      ingested: 0,
      skippedKnown: 0,
      olderThanWindow: 0,
      misses: 0,
      gmpPointsAdded: 0,
      cutoffDate,
      errors: [],
    };
  }

  const report: BackfillReport = {
    fromId,
    nextId: fromId,
    done: false,
    doneReason: null,
    requests: 0,
    ingested: 0,
    skippedKnown: 0,
    olderThanWindow: 0,
    misses: 0,
    gmpPointsAdded: 0,
    cutoffDate,
    errors: [],
  };

  let consecutiveOld = 0;
  let consecutiveMisses = 0;
  let id = fromId;
  while (id > 0 && report.requests < maxRequests) {
    if (knownIds.has(id)) {
      report.skippedKnown++;
      id--;
      continue;
    }
    report.requests++;
    try {
      const detail = await fetchDetail(id);
      consecutiveMisses = 0;
      const opened = detail.openDate;
      if (opened && opened < cutoffDate) {
        report.olderThanWindow++;
        consecutiveOld++;
      } else {
        consecutiveOld = 0;
        const { gmpPoints } = await ingestIgDetail(detail);
        report.ingested++;
        report.gmpPointsAdded += gmpPoints;
      }
    } catch (err) {
      // Withdrawn issues, NCDs and gaps in the id sequence do not parse as an IPO page.
      report.misses++;
      consecutiveMisses++;
      const status = err instanceof UpstreamError ? err.status : undefined;
      if (status === 429 || status === 403) {
        report.errors.push(`id ${id}: upstream refused (${status}); stopping this batch`);
        break;
      }
      if (!(err instanceof UpstreamError) || (status && status >= 500)) {
        report.errors.push(`id ${id}: ${(err as Error).message}`);
      }
    }
    id--;
    if (consecutiveOld >= stopAfterOld) {
      report.done = true;
      report.doneReason = `Reached ${stopAfterOld} consecutive IPOs that opened before ${cutoffDate}.`;
      break;
    }
    if (consecutiveMisses >= stopAfterMisses) {
      report.done = true;
      report.doneReason = `${stopAfterMisses} consecutive ids without an IPO page.`;
      break;
    }
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
  if (id <= 0) {
    report.done = true;
    report.doneReason = 'Reached id 1.';
  }
  report.nextId = Math.max(0, id);
  return report;
}
