'use server';

import { revalidatePath } from 'next/cache';
import { requireStaffAction } from '@/lib/auth';
import { validateEvent, type EventInput } from '@/lib/calendar';
import { deleteSetting, getSetting, saveEvent, setArchived, setSetting } from '@/lib/events';
import { createTrackingSpreadsheet, getGoogleAccessToken } from '@/lib/sheets';
import { SHEET_SETTING, syncSheet, type SheetConfig, type SyncResult } from '@/lib/sync';

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const message = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');

/** Normalizes untrusted client input before validation. */
function normalize(input: EventInput): EventInput {
  return {
    id: String(input.id ?? '').trim().toLowerCase(),
    title: String(input.title ?? ''),
    description: String(input.description ?? ''),
    location: String(input.location ?? ''),
    url: String(input.url ?? '').trim(),
    allDay: Boolean(input.allDay),
    start: String(input.start ?? ''),
    end: String(input.end ?? ''),
    timezone: String(input.timezone ?? ''),
    reminderMinutes: input.reminderMinutes ? Number(input.reminderMinutes) : null,
  };
}

export async function saveEventAction(raw: EventInput, mode: 'new' | 'edit'): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireStaffAction();
    const input = normalize(raw);
    const errors = validateEvent(input);
    if (errors.length) return { ok: false, error: errors.join(' ') };
    const saved = await saveEvent(input, { isNew: mode === 'new', by: user.email });
    revalidatePath('/dashboard');
    return { ok: true, id: saved.id };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

export async function setArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  try {
    const user = await requireStaffAction();
    await setArchived(String(id), Boolean(archived), user.email);
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

/** Creates a new tracking sheet in the current user's Google Drive and fills it with all clicks so far. */
export async function createSheetAction(): Promise<ActionResult<{ sync: SyncResult }>> {
  try {
    const user = await requireStaffAction();
    const token = await getGoogleAccessToken(user.id);
    const sheet = await createTrackingSpreadsheet(token);
    const config: SheetConfig = {
      ...sheet,
      connectedUserId: user.id,
      connectedEmail: user.email,
      connectedAt: new Date().toISOString(),
      lastSyncedClickId: 0,
      rowsSynced: 0,
      lastSyncAt: null,
      lastError: null,
    };
    await setSetting(SHEET_SETTING, config);
    const sync = await syncSheet();
    revalidatePath('/dashboard/integrations');
    return { ok: true, sync };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

export async function syncSheetAction(): Promise<ActionResult<{ sync: SyncResult }>> {
  try {
    await requireStaffAction();
    const sync = await syncSheet();
    revalidatePath('/dashboard/integrations');
    return { ok: true, sync };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

/** Stops syncing. The spreadsheet itself stays in the owner's Google Drive. */
export async function disconnectSheetAction(): Promise<ActionResult> {
  try {
    await requireStaffAction();
    if (await getSetting(SHEET_SETTING)) await deleteSetting(SHEET_SETTING);
    revalidatePath('/dashboard/integrations');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}
