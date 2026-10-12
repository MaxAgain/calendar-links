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
