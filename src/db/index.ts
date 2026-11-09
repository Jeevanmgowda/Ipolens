import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * PostgreSQL Database Connection with Drizzle ORM
 * Compatible with Supabase, Neon, AWS RDS, and self-hosted PostgreSQL.
 * Seamlessly provides fallback when running in standalone / test mode without DATABASE_URL.
 */

let connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

// If password contains raw '@' symbols before the host, URL-encode the password
if (connectionString && connectionString.startsWith('postgres')) {
  const atMatches = connectionString.match(/@/g);
  if (atMatches && atMatches.length > 1) {
    const lastAtIndex = connectionString.lastIndexOf('@');
    const protoEnd = connectionString.indexOf('://') + 3;
    const firstColonIndex = connectionString.indexOf(':', protoEnd);
    if (firstColonIndex > -1 && lastAtIndex > firstColonIndex) {
      const userPart = connectionString.slice(0, firstColonIndex + 1);
      const passwordPart = connectionString.slice(firstColonIndex + 1, lastAtIndex);
      const hostPart = connectionString.slice(lastAtIndex);
      connectionString = userPart + encodeURIComponent(passwordPart) + hostPart;
    }
  }
}

export const isPostgresConfigured = Boolean(
  connectionString && connectionString.startsWith('postgres')
);

let dbClient: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqlConnection: ReturnType<typeof postgres> | null = null;

let isDbCircuitOpen = false;
let dbCircuitCooldownUntil = 0;
let lastDbWarningTime = 0;

export function isDatabaseActive(): boolean {
  if (!isPostgresConfigured || dbClient === null) return false;
  if (isDbCircuitOpen) {
    if (Date.now() < dbCircuitCooldownUntil) return false;
    isDbCircuitOpen = false;
  }
  return true;
}

export function reportDatabaseFailure(operation: string, err: any): void {
  const isNetworkTimeout =
    err?.code === 'CONNECT_TIMEOUT' ||
    err?.code === 'ETIMEDOUT' ||
    err?.code === 'ENOTFOUND' ||
    err?.code === 'ECONNREFUSED' ||
    err?.cause?.code === 'CONNECT_TIMEOUT' ||
    err?.cause?.code === 'ENOTFOUND' ||
    err?.cause?.code === 'ECONNREFUSED' ||
    err?.cause?.code === 'ETIMEDOUT' ||
    err?.message?.includes('CONNECT_TIMEOUT') ||
    err?.message?.includes('ENOTFOUND') ||
    err?.message?.includes('ETIMEDOUT');

  if (isNetworkTimeout) {
    isDbCircuitOpen = true;
    dbCircuitCooldownUntil = Date.now() + 60_000;

    const now = Date.now();
    if (now - lastDbWarningTime > 60_000) {
      console.warn(
        `[Database] PostgreSQL connection unreachable (${err?.cause?.code || err?.code || 'TIMEOUT'}). Activating in-memory store fallback for 60s.`
      );
      lastDbWarningTime = now;
    }
  } else {
    console.warn(`[Database] ${operation} notice:`, err?.message || err);
  }
}

if (isPostgresConfigured) {
  try {
    sqlConnection = postgres(connectionString, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 2,
      prepare: false, // Recommended for Supabase / Neon connection pooler (PgBouncer)
    });
    dbClient = drizzle(sqlConnection, { schema });
    console.log('[Database] PostgreSQL connection pool initialized with Drizzle ORM.');
  } catch (error) {
    console.warn('[Database] Notice: PostgreSQL connection initialization warning:', error);
  }
}

export const db = dbClient;
export { schema };
