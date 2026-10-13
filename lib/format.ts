import type { CalendarEvent } from './calendar';

/** Dashboard date line, always in the event's own time zone. */
export function formatEventDate(e: Pick<CalendarEvent, 'allDay' | 'start' | 'end' | 'startUtc' | 'endUtc' | 'timezone'>): string {
  if (e.allDay) {
    const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const d = (s: string) => new Date(`${s}T12:00:00Z`);
    return e.start === e.end ? `${fmt.format(d(e.start))} · all day` : `${fmt.format(d(e.start))} – ${fmt.format(d(e.end))} · all day`;
  }
  const dateFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: e.timezone });
  const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: e.timezone });
  const start = new Date(e.startUtc);
  const end = new Date(e.endUtc);
  return dateFmt.format(start) === dateFmt.format(end)
    ? `${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)} (${e.timezone})`
    : `${dateFmt.format(start)} ${timeFmt.format(start)} – ${dateFmt.format(end)} ${timeFmt.format(end)} (${e.timezone})`;
}

export const CALENDAR_LABELS: Record<string, string> = {
  apple: 'Apple',
  google: 'Google',
  outlook: 'Outlook desktop',
  outlookcom: 'Outlook.com',
  office365: 'Microsoft 365',
  yahoo: 'Yahoo',
  ics: '.ics file',
};

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(iso));
}

export const OS_LABELS: Record<string, string> = {
  ios: 'iOS',
  android: 'Android',
  macos: 'macOS',
  windows: 'Windows',
  other: 'Other',
};

export const DEVICE_LABELS: Record<string, string> = {
  mobile: 'Mobile',
  tablet: 'Tablet',
  desktop: 'Desktop',
};

export const LANGUAGE_LABELS: Record<string, string> = {
  de: 'German',
  en: 'English',
  other: 'Other',
};

/** 12345 → "12,345" */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-GB').format(n);
}

/** 0.2345 → "23.4%" */
export function formatPercent(ratio: number, digits = 1): string {
  const text = (ratio * 100).toFixed(digits);
  return `${/^-0(\.0+)?$/.test(text) ? text.slice(1) : text}%`;
}

/**
 * Change from `previous` to `current`. `value` is the ratio change (0.12 = +12%).
 * Without a previous value to compare to, the label is "New" and `value` is 1 (positive, but not a real ratio).
 */
export function formatDelta(current: number, previous: number): { value: number; label: string } {
  if (previous === 0) return current > 0 ? { value: 1, label: 'New' } : { value: 0, label: '0.0%' };
  const value = (current - previous) / previous;
  const text = Math.abs(value * 100).toFixed(1);
  if (text === '0.0') return { value, label: '0.0%' };
  return { value, label: `${value > 0 ? '+' : '−'}${text}%` };
}

/** "2026-10-13" → "13 Oct" */
export function formatDay(date: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}
