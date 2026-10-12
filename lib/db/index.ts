import { attachDatabasePool } from '@vercel/functions';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

let db: Db | null = null;

/** Lazily created so `next build` works without DATABASE_URL. */
export function getDb(): Db {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set. Run `npm run env:pull`.');
    const pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 5_000 });
    // Lets Vercel Fluid compute close idle connections before an instance is suspended.
    attachDatabasePool(pool);
    db = drizzle(pool, { schema });
  }
  return db;
}

export * as schema from './schema';
