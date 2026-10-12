// Validation for anonymous tracking beacons. Only whitelisted, coarse values are stored:
// no IP address, no raw user agent, no personal data.
import { CALENDARS, ID_PATTERN } from './calendar';
import { OS_VALUES } from './platform';

export const TRACK_ACTIONS = ['view', 'add', 'not_found'] as const;
export type TrackAction = (typeof TRACK_ACTIONS)[number];

export interface ClickRecord {
  eventId: string | null;
  action: TrackAction;
  calendar: string | null;
  wasRecommended: boolean | null;
  os: string;
  browser: string;
  device: string;
  inApp: string;
  language: string;
  timezone: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  pageSession: string;
  appVersion: string;
}

/** Strips control characters, limits length, blocks spreadsheet formula injection, optional whitelist pattern. */
export function clean(value: unknown, maxLength: number, pattern?: RegExp): string {
  const s = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength)
    .replace(/^[=+\-@]+/, '');
  if (pattern && s && !pattern.test(s)) return '';
  return s;
}

/** UTM values are free text from email links; drop any that look like an email address (e.g. a merge tag). */
function cleanUtm(value: unknown): string {
  const s = clean(value, 100);
  return s.includes('@') ? '' : s;
}

/** Turns an untrusted beacon payload into a record to store, or null to ignore it. */
export function toClickRecord(data: unknown): ClickRecord | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const action = clean(d.action, 20) as TrackAction;
  if (!TRACK_ACTIONS.includes(action)) return null;
  const rawId = clean(d.event_id, 64);
  const eventId = ID_PATTERN.test(rawId) ? rawId : '';
  if (!eventId && action !== 'not_found') return null;
  const calendar = clean(d.calendar, 20);
  const os = clean(d.os, 20);
  return {
    eventId: eventId || null,
    action,
    calendar: (CALENDARS as readonly string[]).includes(calendar) ? calendar : null,
    wasRecommended: action === 'add' ? d.was_recommended === true || d.was_recommended === 'true' : null,
    os: (OS_VALUES as string[]).includes(os) ? os : 'other',
    browser: clean(d.browser, 20, /^[a-z-]+$/),
    device: clean(d.device, 10, /^[a-z]+$/),
    inApp: clean(d.in_app, 20, /^[a-z-]+$/),
    language: clean(d.language, 10, /^[A-Za-z-]+$/),
    timezone: clean(d.timezone, 50, /^[A-Za-z0-9_/+-]+$/),
    utmSource: cleanUtm(d.utm_source),
    utmMedium: cleanUtm(d.utm_medium),
    utmCampaign: cleanUtm(d.utm_campaign),
    utmContent: cleanUtm(d.utm_content),
    pageSession: clean(d.page_session, 32, /^[a-f0-9]+$/),
    appVersion: clean(d.app_version, 20, /^[0-9.]+$/),
  };
}
