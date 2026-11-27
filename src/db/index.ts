import { drizzle } from 'drizzle-orm/postgres-js';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as schema from './schema';
import { databaseUrl } from '@/lib/env';

/**
 * PostgreSQL (Supabase) connection via Drizzle ORM.
 *
 * The database is mandatory: there is no in-memory fallback. Call `getDb()` at the point of
 * use; it throws `DatabaseUnavailableError` with a clear message when DATABASE_URL is missing.
 * Tests inject an in-process Postgres (PGlite) through `setDatabaseForTesting`.
 */

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export class DatabaseUnavailableError extends Error {
  constructor(message = 'Database is not configured. Set DATABASE_URL (Supabase Postgres connection string).') {
    super(message);
    this.name = 'DatabaseUnavailableError';
  }
}

/** URL-encode a password that contains raw '@' characters (common with generated Supabase passwords). */
function normalizeConnectionString(raw: string): string {
  if (!raw.startsWith('postgres')) return raw;
  const atCount = (raw.match(/@/g) || []).length;
  if (atCount <= 1) return raw;
  const lastAt = raw.lastIndexOf('@');
  const protoEnd = raw.indexOf('://') + 3;
  const firstColon = raw.indexOf(':', protoEnd);
  if (firstColon === -1 || lastAt < firstColon) return raw;
  return raw.slice(0, firstColon + 1) + encodeURIComponent(raw.slice(firstColon + 1, lastAt)) + raw.slice(lastAt);
}

let instance: Database | null = null;
let testOverride: Database | null = null;

export function isDatabaseConfigured(): boolean {
  if (testOverride) return true;
  const url = databaseUrl();
  return Boolean(url && url.startsWith('postgres'));
}

export function getDb(): Database {
  if (testOverride) return testOverride;
  if (instance) return instance;

  const url = databaseUrl();
  if (!url || !url.startsWith('postgres')) throw new DatabaseUnavailableError();

  const client = postgres(normalizeConnectionString(url), {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // Required for the Supabase transaction pooler (PgBouncer)
  });
  instance = drizzle(client, { schema }) as unknown as Database;
  return instance;
}

/** Test-only: route all repository calls to the given database (e.g. PGlite). */
export function setDatabaseForTesting(db: Database | null): void {
  testOverride = db;
}

export { schema };
