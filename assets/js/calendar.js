// Shared calendar core: used by the landing page, the dashboard, the CLI script and the tests.
// No dependencies, no DOM access — runs in browsers and Node alike.

export const SCHEMA_VERSION = 1;
export const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
export const CALENDARS = ['apple', 'google', 'outlook', 'outlookcom', 'office365', 'yahoo', 'ics'];

// Calendar providers start truncating or rejecting very long URLs.
export const MAX_SAFE_URL_LENGTH = 2000;

const pad = (n, len = 2) => String(n).padStart(len, '0');

// ---------------------------------------------------------------------------
// Time zones
// ---------------------------------------------------------------------------

function tzOffsetMs(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Converts a wall-clock time ("2026-10-20T18:00") in an IANA time zone to a UTC Date. */
export function zonedTimeToUtc(local, timeZone) {
  const [datePart, timePart = '00:00'] = local.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = tzOffsetMs(new Date(guess), timeZone);
  let utc = guess - offset;
  // Second pass corrects the offset when the guess and the result fall on different sides of a DST change.
  const offset2 = tzOffsetMs(new Date(utc), timeZone);
  if (offset2 !== offset) utc = guess - offset2;
  return new Date(utc);
}

export function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** "2026-10-20" + n days → "2026-10-21" */
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Date → "20261020T160000Z" */
export function formatUtcBasic(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Date → "2026-10-20T16:00:00Z" */
export function formatUtcIso(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** "2026-10-20" → "20261020" */
export const formatDateBasic = (dateStr) => dateStr.replace(/-/g, '');

// ---------------------------------------------------------------------------
// Event model
// ---------------------------------------------------------------------------

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
}

export function suggestId(title, startDate) {
  const base = slugify(title) || 'event';
  const date = (startDate || '').slice(0, 10);
  return date ? `${base}-${date}` : base;
}

/**
 * Builds a complete, normalized event from dashboard/CLI input.
 * For timed events start/end are "YYYY-MM-DDTHH:mm"; for all-day events "YYYY-MM-DD" (end inclusive).
 */
export function buildEvent(input, { uidDomain, now = new Date(), previous = null } = {}) {
  const allDay = Boolean(input.allDay);
  const timezone = input.timezone || 'Europe/Berlin';
  const start = allDay ? String(input.start).slice(0, 10) : String(input.start).slice(0, 16);
  const end = allDay ? String(input.end).slice(0, 10) : String(input.end).slice(0, 16);
  const startUtc = zonedTimeToUtc(allDay ? `${start}T00:00` : start, timezone);
  const endUtc = zonedTimeToUtc(allDay ? `${addDays(end, 1)}T00:00` : end, timezone);
  const nowIso = formatUtcIso(now);
  const id = input.id;

  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    uid: previous?.uid || `${id}@${uidDomain}`,
    title: String(input.title || '').trim(),
    description: String(input.description || '').trim(),
    location: String(input.location || '').trim(),
    url: String(input.url || '').trim(),
    allDay,
    start,
    end,
    timezone,
    startUtc: formatUtcIso(startUtc),
    endUtc: formatUtcIso(endUtc),
    reminderMinutes: input.reminderMinutes ? Number(input.reminderMinutes) : null,
    sequence: previous ? (previous.sequence || 0) + 1 : 0,
    createdAt: previous?.createdAt || nowIso,
    updatedAt: nowIso,
    archived: Boolean(input.archived),
  };
}

/** Returns a list of human-readable problems. Empty list = valid. */
export function validateEvent(input) {
  const errors = [];
  const allDay = Boolean(input.allDay);
  if (!input.id || !ID_PATTERN.test(input.id)) {
    errors.push('Link ID may only contain lowercase letters, numbers and dashes (max. 64 characters).');
  }
  if (!String(input.title || '').trim()) errors.push('Title is required.');
  const datePattern = allDay ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if (!datePattern.test(String(input.start || ''))) errors.push('Start date/time is missing or invalid.');
  if (!datePattern.test(String(input.end || ''))) errors.push('End date/time is missing or invalid.');
  if (!isValidTimeZone(input.timezone || 'Europe/Berlin')) errors.push('Time zone is invalid.');
  if (!errors.length) {
    if (allDay ? input.end < input.start : input.end <= input.start) {
      errors.push(allDay ? 'End date must not be before the start date.' : 'End must be after the start.');
    }
  }
  if (input.url && !/^https?:\/\/\S+$/i.test(String(input.url).trim())) {
    errors.push('Online link must start with https:// (or http://).');
  }
  return errors;
}

export function isPast(event, now = new Date()) {
  return new Date(event.endUtc).getTime() < now.getTime();
}

/** Description text used by URL-based providers: description plus the online link. */
function detailsText(event) {
  const parts = [];
  if (event.description) parts.push(event.description);
  if (event.url && !event.description.includes(event.url)) parts.push(event.url);
  return parts.join('\n\n');
}

function locationText(event) {
  return event.location || event.url || '';
}

// ---------------------------------------------------------------------------
// iCalendar (.ics)
// ---------------------------------------------------------------------------

export function escapeText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function utf8Length(char) {
  const cp = char.codePointAt(0);
  if (cp < 0x80) return 1;
  if (cp < 0x800) return 2;
  if (cp < 0x10000) return 3;
  return 4;
}

/**
 * Folds a content line at 75 octets (RFC 5545 §3.1) without splitting multi-byte characters
 * or escape sequences like "\n" (allowed by the RFC, but some weaker parsers stumble on it).
 */
export function foldLine(line) {
  const out = [];
  let current = '';
  let bytes = 0;
  let limit = 75;
  for (const unit of line.match(/\\.|[\s\S]/gu) || []) {
    const len = [...unit].reduce((sum, char) => sum + utf8Length(char), 0);
    if (bytes + len > limit) {
      out.push(current);
      current = '';
      bytes = 0;
      limit = 74; // continuation lines start with a space
    }
    current += unit;
    bytes += len;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function buildIcs(event, { prodId = '-//Solakon//Add to Calendar//DE' } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${formatUtcBasic(event.updatedAt)}`,
    `SEQUENCE:${event.sequence || 0}`,
  ];
  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatDateBasic(event.start)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDateBasic(addDays(event.end, 1))}`);
  } else {
    lines.push(`DTSTART:${formatUtcBasic(event.startUtc)}`);
    lines.push(`DTEND:${formatUtcBasic(event.endUtc)}`);
  }
  lines.push(`SUMMARY:${escapeText(event.title)}`);
  const details = detailsText(event);
  if (details) lines.push(`DESCRIPTION:${escapeText(details)}`);
  const location = locationText(event);
  if (location) lines.push(`LOCATION:${escapeText(location)}`);
  if (event.url) lines.push(`URL:${event.url.replace(/[\r\n]/g, '')}`);
  lines.push('STATUS:CONFIRMED', 'TRANSP:OPAQUE');
  if (event.reminderMinutes) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(event.title)}`,
      `TRIGGER:-PT${Math.round(event.reminderMinutes)}M`,
      'END:VALARM',
    );
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// URL-based providers
// ---------------------------------------------------------------------------

function query(params) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

export function googleUrl(event) {
  const dates = event.allDay
    ? `${formatDateBasic(event.start)}/${formatDateBasic(addDays(event.end, 1))}`
    : `${formatUtcBasic(event.startUtc)}/${formatUtcBasic(event.endUtc)}`;
  return 'https://calendar.google.com/calendar/render?' + query({
    action: 'TEMPLATE',
    text: event.title,
    dates,
    details: detailsText(event),
    location: locationText(event),
    ctz: event.timezone,
  });
}

/**
 * Outlook on the web. host: 'live' (Outlook.com, personal) or 'office' (Microsoft 365, work/school).
 * Outlook's mobile web app treats the all-day end date as inclusive, desktop as exclusive.
 */
export function outlookUrl(event, { host = 'live', mobile = false } = {}) {
  const base = host === 'office' ? 'https://outlook.office.com' : 'https://outlook.live.com';
  const startdt = event.allDay ? event.start : formatUtcIso(event.startUtc);
  const enddt = event.allDay ? (mobile ? event.end : addDays(event.end, 1)) : formatUtcIso(event.endUtc);
  return `${base}/calendar/0/deeplink/compose?` + query({
    path: '/calendar/action/compose',
    rru: 'addevent',
    startdt,
    enddt,
    allday: event.allDay ? 'true' : '',
    subject: event.title,
    location: locationText(event),
    body: detailsText(event),
  });
}

export function yahooUrl(event) {
  const params = { v: '60', title: event.title };
  if (event.allDay && event.start === event.end) {
    params.dur = 'allday';
    params.st = formatDateBasic(event.start);
  } else if (event.allDay) {
    params.st = formatDateBasic(event.start);
    params.et = formatDateBasic(event.end);
  } else {
    params.st = formatUtcBasic(event.startUtc);
    params.et = formatUtcBasic(event.endUtc);
  }
  params.desc = detailsText(event);
  params.in_loc = locationText(event);
  return 'https://calendar.yahoo.com/?' + query(params);
}

/** Longest generated provider URL — used by the dashboard to warn about very long descriptions. */
export function longestProviderUrl(event) {
  return Math.max(
    googleUrl(event).length,
    outlookUrl(event, { host: 'office' }).length,
    yahooUrl(event).length,
  );
}

// ---------------------------------------------------------------------------
// Event index (events/index.json)
// ---------------------------------------------------------------------------

export function indexEntry(event) {
  return {
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    timezone: event.timezone,
    startUtc: event.startUtc,
    endUtc: event.endUtc,
    updatedAt: event.updatedAt,
    archived: event.archived,
  };
}

/** Returns a new index with the event inserted or replaced, sorted by start (newest first). */
export function upsertIndex(index, event) {
  const events = (index?.events || []).filter((e) => e.id !== event.id);
  events.push(indexEntry(event));
  events.sort((a, b) => (a.startUtc < b.startUtc ? 1 : a.startUtc > b.startUtc ? -1 : 0));
  return { schemaVersion: SCHEMA_VERSION, updatedAt: event.updatedAt, events };
}

export const toJson = (obj) => JSON.stringify(obj, null, 2) + '\n';
