// Copies new clicks from Postgres into the connected Google Sheet.
// Postgres is the source of truth; the Sheet is a convenient view that can be recreated any time.
import { and, asc, eq, gt, lt, sql } from 'drizzle-orm';
import { getDb } from './db';
import { clicks, settings } from './db/schema';
import { clickToRow } from './sheet-layout';
import { appendLogRows, getGoogleAccessToken } from './sheets';

export const SHEET_SETTING = 'google_sheet';
const BATCH_SIZE = 2_000;
const MAX_BATCHES_PER_RUN = 10;

export interface SheetConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  connectedUserId: string;
  connectedEmail: string;
  connectedAt: string;
  lastSyncedClickId: number;
  rowsSynced: number;
  lastSyncAt: string | null;
  lastError: string | null;
}

export type SyncResult =
  | { status: 'not_connected' }
  | { status: 'busy' }
  | { status: 'ok'; rows: number }
  | { status: 'error'; rows: number; error: string };

function isLockNotAvailable(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === '55P03' || e?.cause?.code === '55P03';
}

type BatchResult =
  | { status: 'not_connected' }
  | { status: 'ok'; count: number; more: boolean }
  | { status: 'error'; error: string };

/**
 * Syncs in batches, one short transaction per batch. Each one locks the integration setting row
 * (NOWAIT), so a cron run and a manual "Sync now" can never append the same rows twice, and commits
 * its progress before the next batch starts. If the function dies mid-run, only the batch in flight
 * can be repeated. Accepted residual risk: if an append succeeds but its commit fails, that one
 * batch is appended again on the next run.
 */
export async function syncSheet(): Promise<SyncResult> {
  let rows = 0;
  let token: string | null = null;
  for (let i = 0; i < MAX_BATCHES_PER_RUN; i++) {
    let result: BatchResult;
    try {
      result = await getDb().transaction(async (tx): Promise<BatchResult> => {
        const [row] = await tx.select().from(settings).where(eq(settings.key, SHEET_SETTING)).for('update', { noWait: true });
        if (!row) return { status: 'not_connected' };
        // Always re-read the config under the lock; a copy from an earlier batch may be stale.
        const config = row.value as SheetConfig;
        const save = () => tx.update(settings).set({ value: config, updatedAt: new Date() }).where(eq(settings.key, SHEET_SETTING));
        try {
          token ??= await getGoogleAccessToken(config.connectedUserId);
          // Inserts run after the response, so a lower id can commit after a higher one. Only sync
          // clicks old enough that no earlier id can still be in flight, or the cursor would skip them.
          const batch = await tx
            .select()
            .from(clicks)
            .where(and(gt(clicks.id, config.lastSyncedClickId), lt(clicks.createdAt, sql`now() - interval '1 minute'`)))
            .orderBy(asc(clicks.id))
            .limit(BATCH_SIZE);
          if (batch.length) {
            await appendLogRows(token, config.spreadsheetId, batch.map(clickToRow));
            config.lastSyncedClickId = batch[batch.length - 1].id;
            config.rowsSynced += batch.length;
          }
          config.lastSyncAt = new Date().toISOString();
          config.lastError = null;
          await save();
          return { status: 'ok', count: batch.length, more: batch.length === BATCH_SIZE };
        } catch (err) {
          // Keep the progress made so far; report the problem in the dashboard.
          config.lastError = (err as Error).message;
          config.lastSyncAt = new Date().toISOString();
          await save();
          return { status: 'error', error: config.lastError };
        }
      });
    } catch (err) {
      if (!isLockNotAvailable(err)) throw err;
      // Another sync holds the lock: busy if we never started, otherwise it is carrying on.
      return i === 0 ? { status: 'busy' } : { status: 'ok', rows };
    }
    if (result.status === 'not_connected') return result;
    if (result.status === 'error') return { status: 'error', rows, error: result.error };
    rows += result.count;
    if (!result.more) break;
  }
  return { status: 'ok', rows };
}
