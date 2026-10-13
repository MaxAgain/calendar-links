// Sample analytics for the dashboard, generated deterministically from the event id.
// Replace with real queries over the `clicks` table by switching the export in ./index.ts.
//
// Each event's whole lifetime is generated once as a daily series (independent of the requested range)
// and then sliced, so a 7-day window is always a suffix of the 30-day window. Breakdowns (calendars,
// OS, devices, ...) are allocated from the window totals with the largest-remainder method, so every
// split adds up exactly. No browser APIs and no clock besides the `now` default.
import { addDays, CALENDARS, type CalendarEvent, type CalendarId } from '../calendar';
import { OS_VALUES, recommendCalendar } from '../platform';
import type {
  AnalyticsRange,
  AnalyticsTotals,
  Breakdown,
  CalendarBreakdown,
  DailyPoint,
  Device,
  EventAnalytics,
  OverviewAnalytics,
  Os,
  UtmRow,
} from './types';

const DAY_MS = 86_400_000;
const MAX_ALL_POINTS = 400;
const MAX_UTM_ROWS = 8;
const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const;
const DEVICES: Device[] = ['mobile', 'tablet', 'desktop'];
const LANGUAGES = ['de', 'en', 'other'] as const;

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

/** FNV-1a, 32 bit. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small PRNG returning floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

type Random = () => number;
const rng = (seed: string): Random => mulberry32(hash(seed));
const between = (random: Random, low: number, high: number) => low + (high - low) * random();
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/**
 * Splits a whole number across `weights` so the parts add up exactly (largest remainder).
 * With `caps`, no part exceeds its cap; the total must not exceed the sum of the caps.
 */
function allocate(total: number, weights: number[], caps?: number[]): number[] {
  const out = weights.map(() => 0);
  const room = (i: number) => (caps ? caps[i] - out[i] : Infinity);
  const indices = out.map((_, i) => i);
  let remaining = Math.max(0, Math.round(total));
  while (remaining > 0) {
    let open = indices.filter((i) => room(i) > 0 && weights[i] > 0);
    if (open.length === 0) open = indices.filter((i) => room(i) > 0);
    if (open.length === 0) break;
    const weightSum = sum(open.map((i) => weights[i]));
    const ideals = open.map((i) => (weightSum > 0 ? (remaining * weights[i]) / weightSum : remaining / open.length));
    let given = 0;
    const remainders = open.map((i, k) => {
      const base = Math.min(Math.floor(ideals[k]), room(i));
      out[i] += base;
      given += base;
      return { i, fraction: ideals[k] - Math.floor(ideals[k]) };
    });
    remaining -= given;
    remainders.sort((a, b) => b.fraction - a.fraction || a.i - b.i);
    for (const { i } of remainders) {
      if (remaining <= 0) break;
      if (room(i) > 0) {
        out[i] += 1;
        remaining -= 1;
        given += 1;
      }
    }
    if (given === 0) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dates (UTC days as 'YYYY-MM-DD')
// ---------------------------------------------------------------------------

const utcDate = (value: Date | string) => new Date(value).toISOString().slice(0, 10);
const dayNumber = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
const diffDays = (from: string, to: string) => dayNumber(to) - dayNumber(from);

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

interface Windows {
  dates: string[];
  /** The same-length window right before; null for 'all'. */
  previous: string[] | null;
}

function windowsFor(range: AnalyticsRange, today: string, earliestStart: string): Windows {
  if (range === 'all') {
    const cap = addDays(today, -(MAX_ALL_POINTS - 1));
    let start = earliestStart < today ? earliestStart : today;
    if (start < cap) start = cap;
    return { dates: dateRange(start, today), previous: null };
  }
  const length = RANGE_DAYS[range];
  const start = addDays(today, -(length - 1));
  return { dates: dateRange(start, today), previous: dateRange(addDays(start, -length), addDays(start, -1)) };
}

// ---------------------------------------------------------------------------
// Lifetime series: one send spike, decay, an optional reminder spike, noise
// ---------------------------------------------------------------------------

interface Series {
  /** UTC day of index 0 (the event's createdAt). */
  start: string;
  views: number[];
  adds: number[];
  sessionRatio: number;
}

function buildSeries(event: CalendarEvent, today: string): Series {
  const random = rng(`${event.id}|series`);
  const listSize = Math.exp(between(random, Math.log(400), Math.log(4000))); // size of the mailing list
  const peak = listSize * between(random, 0.18, 0.4); // views on the send day
  const spikeSeed = Math.floor(random() * 3) + 1; // send 1-3 days after creation
  const decay = between(random, 1.2, 2.6); // days until the spike has dropped to 1/e
  const hasReminder = random() < 0.75;
  const reminderLead = Math.floor(random() * 3) + 2; // reminder mail 2-4 days before the event
  const reminderPeak = peak * between(random, 0.25, 0.5);
  const addRate = between(random, 0.15, 0.45);
  const sessionRatio = between(random, 0.85, 0.95);

  const start = utcDate(event.createdAt);
  const eventStart = utcDate(event.startUtc);
  const eventEnd = utcDate(event.endUtc);
  const lastDay = addDays(eventEnd, 14);
  let end = lastDay < today ? lastDay : today;
  if (end < start) end = start;
  if (start > today) return { start, views: [], adds: [], sessionRatio };

  const spikeDay = Math.min(spikeSeed, Math.max(0, diffDays(start, eventStart)));
  const reminderDay = diffDays(start, eventStart) - reminderLead;
  const sendReminder = hasReminder && reminderDay > spikeDay + 1;
  const background = peak * 0.012; // forwarded links, colleagues testing

  const length = diffDays(start, end) + 1;
  const views: number[] = [];
  const adds: number[] = [];
  for (let i = 0; i < length; i++) {
    // One generator per day keeps the series stable when the lifetime grows with `now`.
    const day = rng(`${event.id}|day|${i}`);
    const viewNoise = between(day, 0.8, 1.2);
    const addNoise = between(day, 0.85, 1.15);
    const addRound = day();

    const date = addDays(start, i);
    let expected = background;
    if (i >= spikeDay) expected += peak * Math.exp(-(i - spikeDay) / decay);
    if (sendReminder && i >= reminderDay) expected += reminderPeak * Math.exp(-(i - reminderDay));
    if (date > eventEnd) expected *= 0.2; // late opens after the event
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 6) expected *= 0.65;

    const dayViews = Math.max(0, Math.round(expected * viewNoise));
    const exactAdds = dayViews * addRate * addNoise;
    // Randomized rounding keeps small days from drifting away from the event's add rate.
    const dayAdds = Math.min(dayViews, Math.floor(exactAdds) + (addRound < exactAdds - Math.floor(exactAdds) ? 1 : 0));
    views.push(dayViews);
    adds.push(dayAdds);
  }
  return { start, views, adds, sessionRatio };
}

function slice(series: Series, dates: string[]): DailyPoint[] {
  const first = dates.length ? diffDays(series.start, dates[0]) : 0;
  return dates.map((date, k) => ({ date, views: series.views[first + k] ?? 0, adds: series.adds[first + k] ?? 0 }));
}

function totalsOf(points: DailyPoint[], sessionRatio: number): AnalyticsTotals {
  const views = sum(points.map((p) => p.views));
  const adds = sum(points.map((p) => p.adds));
  return { views, adds, addRate: views > 0 ? adds / views : 0, sessions: Math.min(views, Math.round(views * sessionRatio)) };
}

function sumTotals(list: AnalyticsTotals[]): AnalyticsTotals {
  const views = sum(list.map((t) => t.views));
  const adds = sum(list.map((t) => t.adds));
  return { views, adds, addRate: views > 0 ? adds / views : 0, sessions: sum(list.map((t) => t.sessions)) };
}

// ---------------------------------------------------------------------------
// Breakdowns
// ---------------------------------------------------------------------------

const OS_SHARE: Record<Os, number> = { ios: 0.45, android: 0.3, windows: 0.15, macos: 0.07, other: 0.03 };
/** Who is more likely to add the event once on the page. */
const OS_ADD_BIAS: Record<Os, number> = { ios: 1.1, android: 1, windows: 0.9, macos: 1, other: 0.6 };
/** Matches detectPlatform: only iOS and Android devices are mobile or tablet. */
const DEVICE_BY_OS: Record<Os, Partial<Record<Device, number>>> = {
  ios: { mobile: 0.88, tablet: 0.12 },
  android: { mobile: 0.9, tablet: 0.1 },
  windows: { desktop: 1 },
  macos: { desktop: 1 },
  other: { desktop: 1 },
};
/** Which calendar people pick, per OS. */
const CALENDAR_BY_OS: Record<Os, Partial<Record<CalendarId, number>>> = {
  ios: { apple: 0.82, google: 0.1, office365: 0.03, outlookcom: 0.02, ics: 0.02, yahoo: 0.01 },
  android: { google: 0.85, office365: 0.05, outlookcom: 0.04, ics: 0.04, yahoo: 0.02 },
  windows: { outlook: 0.5, office365: 0.17, google: 0.15, outlookcom: 0.08, ics: 0.06, yahoo: 0.04 },
  macos: { apple: 0.7, google: 0.15, office365: 0.05, outlookcom: 0.04, ics: 0.04, yahoo: 0.02 },
  other: { google: 0.5, ics: 0.15, apple: 0.1, office365: 0.1, outlookcom: 0.1, yahoo: 0.05 },
};
const LANGUAGE_ADD_BIAS = [1, 0.95, 0.8];

/** Calendars that recommendCalendar() returns for at least one OS. */
const RECOMMENDED = new Set<CalendarId>(
  OS_VALUES.map((os) => recommendCalendar({ os, browser: '', device: 'desktop', inApp: '' })),
);

interface UtmTemplate {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  weight: number;
}

function utmTemplates(id: string): UtmTemplate[] {
  return [
    { source: 'klaviyo', medium: 'email', campaign: `${id}-invite`, content: 'button-top', weight: 1 },
    { source: 'klaviyo', medium: 'email', campaign: `${id}-reminder`, content: 'reminder-email', weight: 0.55 },
    { source: 'klaviyo', medium: 'email', campaign: `${id}-invite`, content: 'button-bottom', weight: 0.35 },
    { source: 'linkedin', medium: 'social', campaign: `${id}-post`, content: '', weight: 0.22 },
    { source: 'slack', medium: 'chat', campaign: `${id}-team`, content: '', weight: 0.12 },
  ];
}

interface Breakdowns {
  calendars: CalendarBreakdown[];
  os: Breakdown<Os>[];
  devices: Breakdown<Device>[];
  inApp: { inApp: number; browser: number };
  languages: Breakdown[];
  utm: UtmRow[];
}

/** Splits an event's window totals into every dimension; the parts always add up to the totals. */
function breakdownsFor(eventId: string, views: number, adds: number): Breakdowns {
  // OS: views by the seeded mix, adds by mix times add propensity (never above the OS's views).
  const osRandom = rng(`${eventId}|os`);
  const osWeights = OS_VALUES.map((os) => OS_SHARE[os] * between(osRandom, 0.8, 1.2));
  const osViews = allocate(views, osWeights);
  const osAddWeights = OS_VALUES.map((os, i) => osViews[i] * OS_ADD_BIAS[os] * between(osRandom, 0.9, 1.1));
  const osAdds = allocate(adds, osAddWeights, osViews);

  // Devices follow from the OS counts.
  const deviceViews = DEVICES.map(() => 0);
  const deviceAdds = DEVICES.map(() => 0);
  OS_VALUES.forEach((os, i) => {
    const share = DEVICES.map((device) => DEVICE_BY_OS[os][device] ?? 0);
    const v = allocate(osViews[i], share);
    const a = allocate(osAdds[i], v, v);
    DEVICES.forEach((_, d) => {
      deviceViews[d] += v[d];
      deviceAdds[d] += a[d];
    });
  });

  // Calendars follow from the OS adds.
  const calendarRandom = rng(`${eventId}|calendar`);
  const calendarAdds = CALENDARS.map(() => 0);
  OS_VALUES.forEach((os, i) => {
    const weights = CALENDARS.map((calendar) => (CALENDAR_BY_OS[os][calendar] ?? 0) * between(calendarRandom, 0.85, 1.15));
    allocate(osAdds[i], weights).forEach((count, c) => {
      calendarAdds[c] += count;
    });
  });
  const recommendedRandom = rng(`${eventId}|recommended`);
  const calendars: CalendarBreakdown[] = CALENDARS.map((calendar, c) => {
    const share = between(recommendedRandom, 0.7, 0.85);
    return { calendar, adds: calendarAdds[c], recommended: RECOMMENDED.has(calendar) ? Math.min(calendarAdds[c], Math.round(calendarAdds[c] * share)) : 0 };
  });

  // In-app browsers.
  const inAppShare = between(rng(`${eventId}|in-app`), 0.2, 0.35);
  const [inApp, browser] = allocate(views, [inAppShare, 1 - inAppShare]);

  // Languages.
  const languageRandom = rng(`${eventId}|language`);
  const de = between(languageRandom, 0.8, 0.9);
  const en = Math.min(between(languageRandom, 0.08, 0.15), (1 - de) * 0.9);
  const languageShares = [de, en, 1 - de - en];
  const languageViews = allocate(views, languageShares);
  const languageAdds = allocate(adds, languageViews.map((v, i) => v * LANGUAGE_ADD_BIAS[i]), languageViews);

  // UTM: most views carry campaign tags; the rest is untagged traffic.
  const utmRandom = rng(`${eventId}|utm`);
  const templates = utmTemplates(eventId).slice(0, 2 + Math.floor(utmRandom() * 4));
  const taggedShare = between(utmRandom, 0.72, 0.92);
  const taggedViews = Math.round(views * taggedShare);
  const taggedAdds = Math.min(Math.round(adds * taggedShare), taggedViews);
  const utmWeights = templates.map((t) => t.weight * between(utmRandom, 0.8, 1.2));
  const utmViews = allocate(taggedViews, utmWeights);
  const utmAdds = allocate(taggedAdds, utmViews.map((v) => v * between(utmRandom, 0.8, 1.2)), utmViews);
  const utm: UtmRow[] = templates
    .map((t, i) => ({ source: t.source, medium: t.medium, campaign: t.campaign, content: t.content, views: utmViews[i], adds: utmAdds[i] }))
    .filter((row) => row.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, MAX_UTM_ROWS);

  return {
    calendars: calendars.sort((a, b) => b.adds - a.adds),
    os: OS_VALUES.map((os, i) => ({ key: os, views: osViews[i], adds: osAdds[i] })).sort((a, b) => b.views - a.views),
    devices: DEVICES.map((device, d) => ({ key: device, views: deviceViews[d], adds: deviceAdds[d] })).sort((a, b) => b.views - a.views),
    inApp: { inApp, browser },
    languages: LANGUAGES.map((key, i) => ({ key: key as string, views: languageViews[i], adds: languageAdds[i] })).sort((a, b) => b.views - a.views),
    utm,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getEventAnalytics(event: CalendarEvent, range: AnalyticsRange, now: Date = new Date()): Promise<EventAnalytics> {
  const today = utcDate(now);
  const series = buildSeries(event, today);
  const windows = windowsFor(range, today, utcDate(event.createdAt));
  const daily = slice(series, windows.dates);
  const totals = totalsOf(daily, series.sessionRatio);
  const previous = windows.previous ? totalsOf(slice(series, windows.previous), series.sessionRatio) : null;
  return { eventId: event.id, range, totals, previous, daily, ...breakdownsFor(event.id, totals.views, totals.adds) };
}

export async function getOverviewAnalytics(events: CalendarEvent[], range: AnalyticsRange, now: Date = new Date()): Promise<OverviewAnalytics> {
  const today = utcDate(now);
  const earliest = events.map((event) => utcDate(event.createdAt)).reduce((min, date) => (date < min ? date : min), today);
  const windows = windowsFor(range, today, earliest);

  const daily: DailyPoint[] = windows.dates.map((date) => ({ date, views: 0, adds: 0 }));
  const byEvent: Record<string, AnalyticsTotals> = {};
  const previousTotals: AnalyticsTotals[] = [];
  const calendarSums = new Map<CalendarId, CalendarBreakdown>(CALENDARS.map((calendar) => [calendar, { calendar, adds: 0, recommended: 0 }]));

  for (const event of events) {
    const series = buildSeries(event, today);
    const points = slice(series, windows.dates);
    points.forEach((point, i) => {
      daily[i].views += point.views;
      daily[i].adds += point.adds;
    });
    const totals = totalsOf(points, series.sessionRatio);
    byEvent[event.id] = totals;
    if (windows.previous) previousTotals.push(totalsOf(slice(series, windows.previous), series.sessionRatio));
    for (const row of breakdownsFor(event.id, totals.views, totals.adds).calendars) {
      const entry = calendarSums.get(row.calendar)!;
      entry.adds += row.adds;
      entry.recommended += row.recommended;
    }
  }

  const totals = sumTotals(Object.values(byEvent));
  const notFoundRate = between(rng('analytics|not-found'), 0.01, 0.02);
  const topEvents = Object.entries(byEvent)
    .filter(([, t]) => t.adds > 0)
    .map(([id, t]) => ({ id, views: t.views, adds: t.adds, addRate: t.addRate }))
    .sort((a, b) => b.adds - a.adds || b.views - a.views || (a.id < b.id ? -1 : 1))
    .slice(0, 5);

  return {
    range,
    totals,
    previous: windows.previous ? sumTotals(previousTotals) : null,
    daily,
    calendars: [...calendarSums.values()].sort((a, b) => b.adds - a.adds),
    byEvent,
    topEvents,
    notFound: Math.round(totals.views * notFoundRate),
  };
}
