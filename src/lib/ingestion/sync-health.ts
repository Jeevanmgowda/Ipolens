import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';

/**
 * Sync run log, stored in the existing exchange_snapshots table (symbol '__SYNC__',
 * snapshot_type 'SYNC_RUN'), so the UI can show "as of …" and admins can see failures.
 */

const SYMBOL = '__SYNC__';
const TYPE = 'SYNC_RUN';
const LAST_SUCCESS_TYPE = 'SYNC_LAST_SUCCESS';
const BACKFILL_CHECKPOINT_TYPE = 'BACKFILL_CHECKPOINT';

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
  const finishedAt = run.finishedAt ?? new Date().toISOString();
  const entry = { ...run, finishedAt };
  await db.insert(schema.exchangeSnapshotsTable).values({
    symbol: SYMBOL,
    snapshotType: TYPE,
    data: entry,
  });

  if (run.ok && run.mode === 'live') {
    await db
      .delete(schema.exchangeSnapshotsTable)
      .where(and(eq(schema.exchangeSnapshotsTable.symbol, SYMBOL), eq(schema.exchangeSnapshotsTable.snapshotType, LAST_SUCCESS_TYPE)));
    await db.insert(schema.exchangeSnapshotsTable).values({
      symbol: SYMBOL,
      snapshotType: LAST_SUCCESS_TYPE,
      data: { lastSuccessAt: finishedAt },
    });
  }

  if (run.mode === 'backfill' && run.ok) {
    const s = run.summary as { done?: boolean; nextId?: number } | null;
    await db
      .delete(schema.exchangeSnapshotsTable)
      .where(and(eq(schema.exchangeSnapshotsTable.symbol, SYMBOL), eq(schema.exchangeSnapshotsTable.snapshotType, BACKFILL_CHECKPOINT_TYPE)));
    if (s && !s.done && typeof s.nextId === 'number' && s.nextId > 0) {
      await db.insert(schema.exchangeSnapshotsTable).values({
        symbol: SYMBOL,
        snapshotType: BACKFILL_CHECKPOINT_TYPE,
        data: { nextId: s.nextId },
      });
    }
  }

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
  const db = getDb();
  const [rows, successRows] = await Promise.all([
    db
      .select({ data: schema.exchangeSnapshotsTable.data })
      .from(schema.exchangeSnapshotsTable)
      .where(and(eq(schema.exchangeSnapshotsTable.symbol, SYMBOL), eq(schema.exchangeSnapshotsTable.snapshotType, TYPE)))
      .orderBy(desc(schema.exchangeSnapshotsTable.createdAt))
      .limit(50),
    db
      .select({ data: schema.exchangeSnapshotsTable.data })
      .from(schema.exchangeSnapshotsTable)
      .where(and(eq(schema.exchangeSnapshotsTable.symbol, SYMBOL), eq(schema.exchangeSnapshotsTable.snapshotType, LAST_SUCCESS_TYPE)))
      .orderBy(desc(schema.exchangeSnapshotsTable.createdAt))
      .limit(1),
  ]);
  const runs = rows.map((r) => r.data as SyncRun);
  const storedSuccess = (successRows[0]?.data as { lastSuccessAt?: string } | undefined)?.lastSuccessAt ?? null;
  const lastSuccess = runs.find((r) => r.ok && r.mode === 'live');
  return {
    lastRun: runs[0] ?? null,
    lastSuccessAt: storedSuccess ?? (lastSuccess ? (lastSuccess.finishedAt ?? lastSuccess.startedAt) : null),
  };
}

/** Where an unfinished backfill stopped (the `nextId` of the latest backfill run), if any. */
export async function lastBackfillCursor(): Promise<number | null> {
  const db = getDb();
  const checkpointRows = await db
    .select({ data: schema.exchangeSnapshotsTable.data })
    .from(schema.exchangeSnapshotsTable)
    .where(and(eq(schema.exchangeSnapshotsTable.symbol, SYMBOL), eq(schema.exchangeSnapshotsTable.snapshotType, BACKFILL_CHECKPOINT_TYPE)))
    .orderBy(desc(schema.exchangeSnapshotsTable.createdAt))
    .limit(1);
  const cp = (checkpointRows[0]?.data as { nextId?: number } | undefined)?.nextId;
  if (typeof cp === 'number' && cp > 0) return cp;

  const rows = await db
    .select({ data: schema.exchangeSnapshotsTable.data })
    .from(schema.exchangeSnapshotsTable)
    .where(and(eq(schema.exchangeSnapshotsTable.symbol, SYMBOL), eq(schema.exchangeSnapshotsTable.snapshotType, TYPE)))
    .orderBy(desc(schema.exchangeSnapshotsTable.createdAt))
    .limit(50);
  for (const r of rows) {
    const run = r.data as SyncRun;
    if (run.mode !== 'backfill' || !run.ok) continue;
    const s = run.summary as { done?: boolean; nextId?: number } | null;
    return s && !s.done && typeof s.nextId === 'number' && s.nextId > 0 ? s.nextId : null;
  }
  return null;
}
