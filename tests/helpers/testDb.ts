import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import path from 'path';
import * as schema from '@/db/schema';
import { setDatabaseForTesting, type Database } from '@/db';

/**
 * Spins up an in-process Postgres (PGlite + pgvector), applies every Drizzle migration in
 * ./drizzle and routes the app's getDb() to it. Each call returns a fresh, empty database.
 */
export async function createTestDatabase(): Promise<{ db: Database; close: () => Promise<void> }> {
  const client = new PGlite({ extensions: { vector } });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  setDatabaseForTesting(db as unknown as Database);
  return {
    db: db as unknown as Database,
    close: async () => {
      setDatabaseForTesting(null);
      await client.close();
    },
  };
}
