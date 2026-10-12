// Event storage (Postgres) with a Runtime Cache in front of the public read path.
import { getCache } from '@vercel/functions';
import { desc, eq, sql } from 'drizzle-orm';
import { buildEvent, type CalendarEvent, type EventInput } from './calendar';
import { getDb } from './db';
import { clicks, events, settings, type EventRow } from './db/schema';
import { UID_DOMAIN } from './site';

const eventTag = (id: string) => `event:${id}`;

export class EventConflictError extends Error {}

export function rowToEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    uid: row.uid,
    title: row.title,
    description: row.description,
    location: row.location,
    url: row.url,
    allDay: row.allDay,
    start: row.startLocal,
    end: row.endLocal,
    timezone: row.timezone,
    startUtc: row.startUtc.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    endUtc: row.endUtc.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    reminderMinutes: row.reminderMinutes,
    sequence: row.sequence,
    createdAt: row.createdAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    updatedAt: row.updatedAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    archived: row.archived,
  };
}

function eventToValues(e: CalendarEvent) {
  return {
    id: e.id,
    uid: e.uid,
    title: e.title,
    description: e.description,
    location: e.location,
    url: e.url,
    allDay: e.allDay,
    startLocal: e.start,
    endLocal: e.end,
    timezone: e.timezone,
    startUtc: new Date(e.startUtc),
    endUtc: new Date(e.endUtc),
    reminderMinutes: e.reminderMinutes,
    sequence: e.sequence,
    archived: e.archived,
    createdAt: new Date(e.createdAt),
    updatedAt: new Date(e.updatedAt),
  };
}

/** Cache failures must never break the recipient page. */
function cache() {
  try {
    return getCache({ namespace: 'calendar-links' });
  } catch {
    return null;
  }
}

async function expireEventCache(id: string) {
  try {
    await cache()?.expireTag(eventTag(id));
  } catch (err) {
    console.error('Could not expire event cache', id, err);
  }
}

/** Read path for recipient pages and .ics files: cached for an hour, expired on every change. */
export async function getPublicEvent(id: string): Promise<CalendarEvent | null> {
  const key = `event:${id}`;
  try {
    const hit = (await cache()?.get(key)) as { event: CalendarEvent | null } | null | undefined;
    if (hit) return hit.event;
  } catch (err) {
    console.error('Runtime cache read failed', err);
  }
  const event = await getEvent(id);
  try {
    // Unknown IDs are cached briefly so a typo'd link in a big send can't hammer the database.
    await cache()?.set(key, { event }, { ttl: event ? 3_600 : 60, tags: [eventTag(id)], name: 'event' });
  } catch (err) {
    console.error('Runtime cache write failed', err);
  }
  return event;
}

/** Uncached read for the dashboard. */
export async function getEvent(id: string): Promise<CalendarEvent | null> {
  const [row] = await getDb().select().from(events).where(eq(events.id, id)).limit(1);
  return row ? rowToEvent(row) : null;
}

export async function listEvents(): Promise<CalendarEvent[]> {
  const rows = await getDb().select().from(events).orderBy(desc(events.startUtc));
  return rows.map(rowToEvent);
}

export async function eventIdExists(id: string): Promise<boolean> {
  const [row] = await getDb().select({ id: events.id }).from(events).where(eq(events.id, id)).limit(1);
  return Boolean(row);
}

/** Creates or updates an event. The row lock serializes concurrent edits of the same event. */
export async function saveEvent(input: EventInput, { isNew, by }: { isNew: boolean; by: string }): Promise<CalendarEvent> {
  const saved = await getDb().transaction(async (tx) => {
    const [current] = await tx.select().from(events).where(eq(events.id, input.id)).for('update');
    if (isNew && current) {
      throw new EventConflictError(`The link ID "${input.id}" is already used by another event. Please choose a different link ID.`);
    }
    if (!isNew && !current) throw new Error(`Event "${input.id}" no longer exists.`);
    const previous = current ? rowToEvent(current) : null;
    const event = buildEvent({ ...input, archived: previous?.archived ?? false }, { uidDomain: UID_DOMAIN, previous });
    const values = eventToValues(event);
    if (current) {
      // Identity and creation fields are immutable once the row exists.
      const changes: Partial<typeof values> = { ...values };
      delete changes.id;
      delete changes.uid;
      delete changes.createdAt;
      await tx.update(events).set({ ...changes, updatedBy: by }).where(eq(events.id, input.id));
    } else {
      await tx.insert(events).values({ ...values, createdBy: by, updatedBy: by });
    }
    return event;
  });
  await expireEventCache(saved.id);
  return saved;
}

/** Archived events show "not available" to recipients. Events are never deleted. */
export async function setArchived(id: string, archived: boolean, by: string): Promise<void> {
  await getDb().update(events).set({ archived, updatedAt: new Date(), updatedBy: by }).where(eq(events.id, id));
  await expireEventCache(id);
}

// ---------------------------------------------------------------------------- tracking + stats

export async function insertClick(record: typeof clicks.$inferInsert): Promise<void> {
  await getDb().insert(clicks).values(record);
}

export interface EventStats {
  views: number;
  adds: number;
  calendars: Record<string, number>;
}

export interface StatsSummary {
  byEvent: Record<string, EventStats>;
  totals: { views: number; adds: number; notFound: number };
}

export async function getStats(): Promise<StatsSummary> {
  const rows = await getDb()
    .select({ eventId: clicks.eventId, action: clicks.action, calendar: clicks.calendar, count: sql<number>`count(*)::int` })
    .from(clicks)
    .groupBy(clicks.eventId, clicks.action, clicks.calendar);

  const summary: StatsSummary = { byEvent: {}, totals: { views: 0, adds: 0, notFound: 0 } };
  for (const row of rows) {
    if (row.action === 'not_found') {
      summary.totals.notFound += row.count;
      continue;
    }
    if (!row.eventId) continue;
    const ev = (summary.byEvent[row.eventId] ??= { views: 0, adds: 0, calendars: {} });
    if (row.action === 'view') {
      ev.views += row.count;
      summary.totals.views += row.count;
    } else if (row.action === 'add') {
      ev.adds += row.count;
      summary.totals.adds += row.count;
      if (row.calendar) ev.calendars[row.calendar] = (ev.calendars[row.calendar] ?? 0) + row.count;
    }
  }
  return summary;
}

// ---------------------------------------------------------------------------- settings

export async function getSetting<T>(key: string): Promise<T | null> {
  const [row] = await getDb().select().from(settings).where(eq(settings.key, key)).limit(1);
  return (row?.value as T) ?? null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await getDb()
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export async function deleteSetting(key: string): Promise<void> {
  await getDb().delete(settings).where(eq(settings.key, key));
}
