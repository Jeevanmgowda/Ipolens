import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';

/**
 * Sync run log, stored in the existing exchange_snapshots table (symbol '__SYNC__',
 * snapshot_type 'SYNC_RUN'), so the UI can show "as of …" and admins can see failures.
 */

const SYMBOL = '__SYNC__';
const TYPE = 'SYNC_RUN';

export interface SyncRun {
  mode: string;
  startedAt: string;
  finishedAt?: string;
  ok: boolean;
  summary: unknown;
}

export interface SyncHealth {
  lastRun: SyncRun | null;
  lastSuccessAt: string | null;
}

export async function recordSyncRun(run: SyncRun): Promise<void> {
  const db = getDb();
  await db.insert(schema.exchangeSnapshotsTable).values({
    symbol: SYMBOL,
    snapshotType: TYPE,
    data: { ...run, finishedAt: run.finishedAt ?? new Date().toISOString() },
  });
  // Keep the log small.
  await db.execute(sql`
    delete from exchange_snapshots
    where symbol = ${SYMBOL} and snapshot_type = ${TYPE}
      and id not in (
        select id from exchange_snapshots
        where symbol = ${SYMBOL} and snapshot_type = ${TYPE}
        order by created_at desc limit 200
      )`);
}

export async function readSyncHealth(): Promise<SyncHealth> {
  const rows = await getDb()
    .select({ data: schema.exchangeSnapshotsTable.data })
    .from(schema.exchangeSnapshotsTable)
    .where(and(eq(schema.exchangeSnapshotsTable.symbol, SYMBOL), eq(schema.exchangeSnapshotsTable.snapshotType, TYPE)))
    .orderBy(desc(schema.exchangeSnapshotsTable.createdAt))
    .limit(50);
  const runs = rows.map((r) => r.data as SyncRun);
  const lastSuccess = runs.find((r) => r.ok && r.mode === 'live');
  return {
    lastRun: runs[0] ?? null,
    lastSuccessAt: lastSuccess ? (lastSuccess.finishedAt ?? lastSuccess.startedAt) : null,
  };
}
