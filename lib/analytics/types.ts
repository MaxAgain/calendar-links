// Shapes of the dashboard analytics. They mirror the `clicks` table (lib/db/schema.ts), so a real
// Postgres implementation can return exactly the same objects. Everything here is plain JSON data
// because the results are handed from server components to client chart components.
import type { CalendarId } from '../calendar';
import type { Platform } from '../platform';

export type AnalyticsRange = '7d' | '30d' | '90d' | 'all';

export type Os = Platform['os'];
export type Device = Platform['device'];

export interface AnalyticsTotals {
  /** Page views (`action = 'view'`). */
  views: number;
  /** Calendar clicks (`action = 'add'`). */
  adds: number;
  /** adds / views as a ratio between 0 and 1; 0 when there are no views. */
  addRate: number;
  /** Unique page sessions, never more than `views`. */
  sessions: number;
}

export interface DailyPoint {
  /** UTC day, 'YYYY-MM-DD'. */
  date: string;
  views: number;
  adds: number;
}

export interface CalendarBreakdown {
  calendar: CalendarId;
  adds: number;
  /** Adds where `was_recommended` is true, never more than `adds`. */
  recommended: number;
}

export interface Breakdown<K extends string = string> {
  key: K;
  views: number;
  adds: number;
}

export interface UtmRow {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  views: number;
  adds: number;
}

export interface EventAnalytics {
  eventId: string;
  range: AnalyticsRange;
  totals: AnalyticsTotals;
  /** The same-length window right before this one; null for 'all'. */
  previous: AnalyticsTotals | null;
  /** One point per day in the window, zero-filled. */
  daily: DailyPoint[];
  /** All 7 calendars, sorted by adds descending. */
  calendars: CalendarBreakdown[];
  /** Sorted by views descending. */
  os: Breakdown<Os>[];
  devices: Breakdown<Device>[];
  /** Views split into in-app browsers and regular browsers. */
  inApp: { inApp: number; browser: number };
  /** Keys like 'de', 'en', 'other'. */
  languages: Breakdown[];
  /** Sorted by views descending, at most 8 rows. */
  utm: UtmRow[];
}

export interface OverviewAnalytics {
  range: AnalyticsRange;
  totals: AnalyticsTotals;
  previous: AnalyticsTotals | null;
  daily: DailyPoint[];
  calendars: CalendarBreakdown[];
  /** Every event id that was passed in, for the range. */
  byEvent: Record<string, AnalyticsTotals>;
  /** Top 5 by adds within the range; events without adds are left out. */
  topEvents: { id: string; views: number; adds: number; addRate: number }[];
  /** Broken-link hits (`action = 'not_found'`) in the range. */
  notFound: number;
}
