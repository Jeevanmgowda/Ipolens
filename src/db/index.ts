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

if (isPostgresConfigured) {
  try {
    sqlConnection = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false, // Recommended for Supabase / Neon connection pooler (PgBouncer)
    });
    dbClient = drizzle(sqlConnection, { schema });
    console.log('[Database] PostgreSQL connection pool initialized with Drizzle ORM.');
  } catch (error) {
    console.warn('[Database] Notice: PostgreSQL connection initialization warning:', error);
  }
} else {
  // Graceful standalone notice (no hard crashes during local builds or tests)
  // console.log('[Database] Running in standalone / memory-cached mode. Set DATABASE_URL to enable PostgreSQL persistence.');
}

export const db = dbClient;
export { schema };
