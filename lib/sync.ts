// Copies new clicks from Postgres into the connected Google Sheet.
// Postgres is the source of truth. The Sheet is a copy that only ever grows: rows are appended, never changed.
import { and, asc, eq, gt, lt, sql } from 'drizzle-orm';
import { getDb } from './db';
import { clicks, settings } from './db/schema';
import { clickToRow, DEFAULT_LOG_TAB, type ExistingRows, type LogLayout } from './sheet-layout';
import { appendLogRows, getGoogleAccessToken, prepareLogTab, readExistingRows } from './sheets';

export const SHEET_SETTING = 'google_sheet';
const BATCH_SIZE = 2_000;
const MAX_BATCHES_PER_RUN = 10;

export interface SheetConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  /** Missing in configs saved before existing sheets could be connected. */
  spreadsheetTitle?: string;
  /** Tab that receives one row per click. Missing in older configs: "Log". */
  sheetName?: string;
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
 * (NOWAIT), so a cron run and a manual "Sync now" never run at the same time, and commits its progress
 * before the next batch starts. On top of the cursor, every run reads which clicks the sheet already
 * holds (click_id, or the row contents for rows written before click_id existed) and skips them, so a
 * newly connected sheet that already has rows, or a batch whose commit failed, is never duplicated.
 */
export async function syncSheet(): Promise<SyncResult> {
  let rows = 0;
  let token: string | null = null;
  let layout: LogLayout | null = null;
  let existing: ExistingRows | null = null;
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
          const tab = config.sheetName || DEFAULT_LOG_TAB;
          // Read the header every run: columns may have been moved or renamed in the sheet since the last sync.
          layout ??= await prepareLogTab(token, config.spreadsheetId, tab);
          existing ??= await readExistingRows(token, config.spreadsheetId, tab, layout);
          // Inserts run after the response, so a lower id can commit after a higher one. Only sync
          // clicks old enough that no earlier id can still be in flight, or the cursor would skip them.
          const batch = await tx
            .select()
            .from(clicks)
            .where(and(gt(clicks.id, config.lastSyncedClickId), lt(clicks.createdAt, sql`now() - interval '1 minute'`)))
            .orderBy(asc(clicks.id))
            .limit(BATCH_SIZE);
          const known = existing;
          const fresh = batch.map(clickToRow).filter((row) => !known.has(row));
          if (fresh.length) {
            await appendLogRows(token, config.spreadsheetId, tab, layout, fresh);
            fresh.forEach((row) => known.add(row));
            config.rowsSynced += fresh.length;
          }
          if (batch.length) config.lastSyncedClickId = batch[batch.length - 1].id;
          config.lastSyncAt = new Date().toISOString();
          config.lastError = null;
          await save();
          return { status: 'ok', count: fresh.length, more: batch.length === BATCH_SIZE };
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
