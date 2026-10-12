import { bigserial, boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

/** Calendar events. `id` is the link slug and can never change once published. */
export const events = pgTable('events', {
  id: text('id').primaryKey(),
  uid: text('uid').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  location: text('location').notNull().default(''),
  url: text('url').notNull().default(''),
  allDay: boolean('all_day').notNull().default(false),
  startLocal: text('start_local').notNull(),
  endLocal: text('end_local').notNull(),
  timezone: text('timezone').notNull(),
  startUtc: timestamptz('start_utc').notNull(),
  endUtc: timestamptz('end_utc').notNull(),
  reminderMinutes: integer('reminder_minutes'),
  sequence: integer('sequence').notNull().default(0),
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  createdBy: text('created_by'),
  updatedBy: text('updated_by'),
});

/** Anonymous page views and calendar clicks from email recipients. */
export const clicks = pgTable(
  'clicks',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    eventId: text('event_id'),
    action: text('action').notNull(),
    calendar: text('calendar'),
    wasRecommended: boolean('was_recommended'),
    os: text('os').notNull().default('other'),
    browser: text('browser').notNull().default(''),
    device: text('device').notNull().default(''),
    inApp: text('in_app').notNull().default(''),
    language: text('language').notNull().default(''),
    timezone: text('timezone').notNull().default(''),
    utmSource: text('utm_source').notNull().default(''),
    utmMedium: text('utm_medium').notNull().default(''),
    utmCampaign: text('utm_campaign').notNull().default(''),
    utmContent: text('utm_content').notNull().default(''),
    pageSession: text('page_session').notNull().default(''),
    appVersion: text('app_version').notNull().default(''),
  },
  (t) => [index('clicks_event_action_idx').on(t.eventId, t.action)],
);

/** Small key/value store for app settings (e.g. the Google Sheet integration). */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export type EventRow = typeof events.$inferSelect;
export type ClickRow = typeof clicks.$inferSelect;
