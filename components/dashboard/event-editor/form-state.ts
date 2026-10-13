import { addDays, suggestId, type CalendarEvent, type EventInput } from '@/lib/calendar';

export interface FormState {
  title: string;
  description: string;
  location: string;
  url: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timezone: string;
  /** Minutes before the start as a string; '' means no reminder. */
  reminder: string;
  id: string;
}

export type EditorMode = 'new' | 'edit';

export const COMMON_ZONES = ['Europe/Berlin', 'Europe/Vienna', 'Europe/Zurich', 'Europe/Amsterdam', 'Europe/Paris', 'Europe/London', 'UTC'];

let allZonesCache: string[] | null = null;
/** Every supported zone except the common ones. Browser-only data, so read it through useSyncExternalStore. */
export const allZones = () =>
  (allZonesCache ??= (() => {
    try {
      return Intl.supportedValuesOf('timeZone').filter((z) => !COMMON_ZONES.includes(z));
    } catch {
      return [];
    }
  })());
export const noZones: string[] = [];
export const noopSubscribe = () => () => {};

export const REMINDER_OPTIONS = [
  { value: '', label: 'No reminder' },
  { value: '10', label: '10 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '120', label: '2 hours before' },
  { value: '1440', label: '1 day before' },
] as const;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Today plus `offsetDays` as 'yyyy-MM-dd' in `timeZone`. The editor renders on the server too, so the default
 * date must not depend on the machine's own zone (server in UTC vs browser), or hydration can mismatch around midnight.
 */
export function localDate(offsetDays = 0, timeZone = 'Europe/Berlin') {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return addDays(today, offsetDays);
}

export function addMinutes(date: string, time: string, minutes: number) {
  const [hh, mm] = time.split(':').map(Number);
  const total = hh * 60 + mm + minutes;
  const rest = ((total % 1440) + 1440) % 1440;
  return { date: addDays(date, Math.floor(total / 1440)), time: `${pad(Math.floor(rest / 60))}:${pad(rest % 60)}` };
}

export function uniqueId(base: string, taken: Set<string>) {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base.slice(0, 60)}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function initialState(
  initial: CalendarEvent | null | undefined,
  mode: EditorMode,
  defaultTimezone: string,
  taken: Set<string>,
): FormState {
  if (!initial) {
    const day = localDate(7, defaultTimezone);
    return {
      title: '', description: '', location: '', url: '', allDay: false,
      startDate: day, startTime: '18:00', endDate: day, endTime: '19:00',
      timezone: defaultTimezone, reminder: '60', id: '',
    };
  }
  return {
    title: initial.title,
    description: initial.description,
    location: initial.location,
    url: initial.url,
    allDay: initial.allDay,
    startDate: initial.start.slice(0, 10),
    startTime: initial.allDay ? '18:00' : initial.start.slice(11, 16),
    endDate: initial.end.slice(0, 10),
    endTime: initial.allDay ? '19:00' : initial.end.slice(11, 16),
    timezone: initial.timezone,
    reminder: initial.reminderMinutes ? String(initial.reminderMinutes) : '',
    id: mode === 'edit' ? initial.id : uniqueId(suggestId(initial.title, initial.start), taken),
  };
}

export function toInput(f: FormState): EventInput {
  return {
    id: f.id.trim().toLowerCase(),
    title: f.title,
    description: f.description,
    location: f.location,
    url: f.url.trim(),
    allDay: f.allDay,
    start: f.allDay ? f.startDate : `${f.startDate}T${f.startTime}`,
    end: f.allDay ? f.endDate : `${f.endDate}T${f.endTime}`,
    timezone: f.timezone,
    reminderMinutes: f.reminder ? Number(f.reminder) : null,
  };
}

/** Applies a change and keeps the derived fields in step (link ID suggestion, end after start). */
export function applyChanges(
  prev: FormState,
  changes: Partial<FormState>,
  opts: { mode: EditorMode; idTouched: boolean; taken: Set<string> },
): FormState {
  const next = { ...prev, ...changes };
  if (opts.mode === 'new' && !opts.idTouched && ('title' in changes || 'startDate' in changes)) {
    next.id = next.title.trim() ? uniqueId(suggestId(next.title, next.startDate), opts.taken) : '';
  }
  // Keep the end after the start when the start moves.
  if ('startDate' in changes || 'startTime' in changes || 'allDay' in changes) {
    if (next.allDay) {
      if (!next.endDate || next.endDate < next.startDate) next.endDate = next.startDate;
    } else if (next.startDate && next.startTime) {
      const start = `${next.startDate}T${next.startTime}`;
      if (!next.endDate || !next.endTime || `${next.endDate}T${next.endTime}` <= start) {
        const end = addMinutes(next.startDate, next.startTime, 60);
        next.endDate = end.date;
        next.endTime = end.time;
      }
    }
  }
  return next;
}
