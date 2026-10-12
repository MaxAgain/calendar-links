'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { saveEventAction } from '@/app/(admin)/dashboard/actions';
import {
  addDays, buildEvent, ID_PATTERN, isPast, longestProviderUrl, MAX_SAFE_URL_LENGTH, suggestId, validateEvent,
  type CalendarEvent, type EventInput,
} from '@/lib/calendar';
import { UID_DOMAIN } from '@/lib/site';

interface FormState {
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
  reminder: string;
  id: string;
}

interface Props {
  mode: 'new' | 'edit';
  /** Event to edit, or template when duplicating. */
  initial?: CalendarEvent | null;
  existingIds: string[];
  siteUrl: string;
  defaultTimezone: string;
}

const COMMON_ZONES = ['Europe/Berlin', 'Europe/Vienna', 'Europe/Zurich', 'Europe/Amsterdam', 'Europe/Paris', 'Europe/London', 'UTC'];
let allZonesCache: string[] | null = null;
const allZones = () => (allZonesCache ??= (() => {
  try {
    return Intl.supportedValuesOf('timeZone').filter((z) => !COMMON_ZONES.includes(z));
  } catch {
    return [];
  }
})());
const noZones: string[] = [];
const noopSubscribe = () => () => {};

const pad = (n: number) => String(n).padStart(2, '0');
function localDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addMinutes(date: string, time: string, minutes: number) {
  const [hh, mm] = time.split(':').map(Number);
  const total = hh * 60 + mm + minutes;
  const rest = ((total % 1440) + 1440) % 1440;
  return { date: addDays(date, Math.floor(total / 1440)), time: `${pad(Math.floor(rest / 60))}:${pad(rest % 60)}` };
}
function uniqueId(base: string, taken: Set<string>) {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base.slice(0, 60)}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

function initialState(initial: CalendarEvent | null | undefined, mode: Props['mode'], defaultTimezone: string, taken: Set<string>): FormState {
  if (!initial) {
    const day = localDate(7);
    return { title: '', description: '', location: '', url: '', allDay: false, startDate: day, startTime: '18:00', endDate: day, endTime: '19:00', timezone: defaultTimezone, reminder: '60', id: '' };
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

function toInput(f: FormState): EventInput {
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

export function EventEditor({ mode, initial, existingIds, siteUrl, defaultTimezone }: Props) {
  const router = useRouter();
  const taken = useMemo(() => new Set(existingIds), [existingIds]);
  const [form, setForm] = useState<FormState>(() => initialState(initial, mode, defaultTimezone, taken));
  const [idTouched, setIdTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState('');
  const [pending, startTransition] = useTransition();
  const [previewPlatform, setPreviewPlatform] = useState('ios');
  const [previewLang, setPreviewLang] = useState<'de' | 'en'>('de');
  const [previewReady, setPreviewReady] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const zones = useSyncExternalStore(noopSubscribe, allZones, () => noZones);

  const input = toInput(form);
  const errors = validateEvent(input);
  if (mode === 'new' && ID_PATTERN.test(input.id) && taken.has(input.id)) {
    errors.push(`The link ID "${input.id}" is already used. Please choose another one.`);
  }
  const draft = useMemo<CalendarEvent | null>(() => {
    const current = toInput(form);
    const previewInput = { ...current, id: ID_PATTERN.test(current.id) ? current.id : 'preview', title: current.title.trim() || 'Untitled event' };
    if (validateEvent(previewInput).length) return null;
    return buildEvent(previewInput, { uidDomain: UID_DOMAIN, previous: mode === 'edit' ? initial : null });
  }, [form, mode, initial]);

  const warnings: string[] = [];
  if (draft && !errors.length) {
    if (isPast(draft)) warnings.push('This event is in the past. Recipients will see “has already taken place”.');
    if (longestProviderUrl(draft) > MAX_SAFE_URL_LENGTH) {
      warnings.push('The description is very long. Google/Outlook may cut it off — consider shortening it. (The Apple/.ics version keeps the full text.)');
    }
  }

  // ---- live preview: the real recipient page in an iframe, fed via postMessage
  useEffect(() => {
    const onMessage = (msg: MessageEvent) => {
      if (msg.origin === window.location.origin && msg.data?.type === 'atc-preview-ready') setPreviewReady(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!previewReady || !draft) return;
    const timer = setTimeout(() => {
      frame.current?.contentWindow?.postMessage({ type: 'atc-preview', event: draft, platform: previewPlatform, lang: previewLang }, window.location.origin);
    }, 150);
    return () => clearTimeout(timer);
  }, [draft, previewPlatform, previewLang, previewReady]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // ---- field updates
  const update = useCallback(
    (changes: Partial<FormState>) => {
      setDirty(true);
      setForm((prev) => {
        const next = { ...prev, ...changes };
        if (mode === 'new' && !idTouched && ('title' in changes || 'startDate' in changes)) {
          next.id = next.title.trim() ? uniqueId(suggestId(next.title, next.startDate), taken) : '';
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
      });
    },
    [mode, idTouched, taken],
  );

  const field = (name: keyof FormState) => ({
    id: `f-${name}`,
    name,
    value: form[name] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => update({ [name]: e.target.value }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    setServerError('');
    if (errors.length) return;
    startTransition(async () => {
      const result = await saveEventAction(input, mode);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      setDirty(false);
      router.push(`/dashboard/events/${result.id}/share`);
    });
  };

  const link = `${siteUrl}/e/${input.id || '…'}`;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{mode === 'edit' ? 'Edit event' : initial ? 'Duplicate event' : 'New event'}</h1>
        <Link
          className="btn"
          href="/dashboard"
          onClick={(e) => {
            if (dirty && !window.confirm('Discard your changes?')) e.preventDefault();
          }}
        >
          Cancel
        </Link>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_440px]">
        <form className="panel" onSubmit={submit} noValidate>
          <div className="mb-3.5">
            <label className="field-label" htmlFor="f-title">Title <span className="text-red-700">*</span></label>
            <input className="input" type="text" maxLength={200} autoComplete="off" aria-invalid={showErrors && !input.title.trim()} {...field('title')} />
          </div>
          <div className="mb-3.5">
            <label className="field-label" htmlFor="f-description">Description</label>
            <textarea className="input" rows={5} maxLength={3000} {...field('description')} />
            <p className="hint">Plain text. Line breaks and links are kept. Shown on the page and in the calendar entry.</p>
          </div>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <div className="mb-3.5">
              <label className="field-label" htmlFor="f-location">Location</label>
              <input className="input" type="text" maxLength={300} placeholder="Address or “Online”" {...field('location')} />
            </div>
            <div className="mb-3.5">
              <label className="field-label" htmlFor="f-url">Online link</label>
              <input className="input" type="url" maxLength={500} placeholder="https://…" {...field('url')} />
            </div>
          </div>

          <fieldset className="mb-3.5 rounded-lg border border-sk-gray-200 px-3.5 pb-1 pt-3">
            <legend className="px-1 font-semibold">Date &amp; time <span className="text-red-700">*</span></legend>
            <label className="mb-2.5 inline-flex items-center gap-2 font-medium">
              <input type="checkbox" checked={form.allDay} onChange={(e) => update({ allDay: e.target.checked })} /> All-day event
            </label>
            <div className="grid gap-x-3 sm:grid-cols-2">
              {(['start', 'end'] as const).map((which) => (
                <div className="mb-3.5" key={which}>
                  <label className="field-label" htmlFor={`f-${which}Date`}>{which === 'start' ? 'Start' : 'End'}</label>
                  <div className="flex gap-2">
                    <input className="input min-w-0 flex-1" type="date" {...field(`${which}Date`)} />
                    {!form.allDay && <input className="input w-30 flex-none" type="time" step={300} {...field(`${which}Time`)} />}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid gap-x-3 sm:grid-cols-2">
              <div className="mb-3.5">
                <label className="field-label" htmlFor="f-timezone">Time zone</label>
                <select className="input" {...field('timezone')}>
                  <optgroup label="Common">{COMMON_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}</optgroup>
                  {zones.length > 0 && <optgroup label="All time zones">{zones.map((z) => <option key={z} value={z}>{z}</option>)}</optgroup>}
                  {!COMMON_ZONES.includes(form.timezone) && !zones.includes(form.timezone) && <option value={form.timezone}>{form.timezone}</option>}
                </select>
              </div>
              <div className="mb-3.5">
                <label className="field-label" htmlFor="f-reminder">Reminder</label>
                <select className="input" {...field('reminder')}>
                  <option value="">No reminder</option>
                  <option value="10">10 minutes before</option>
                  <option value="30">30 minutes before</option>
                  <option value="60">1 hour before</option>
                  <option value="120">2 hours before</option>
                  <option value="1440">1 day before</option>
                </select>
              </div>
            </div>
          </fieldset>

          <div className="mb-3.5">
            <label className="field-label" htmlFor="f-id">Link ID <span className="text-red-700">*</span></label>
            <input
              className="input font-mono"
              type="text"
              maxLength={64}
              autoComplete="off"
              spellCheck={false}
              readOnly={mode === 'edit'}
              aria-invalid={showErrors && errors.some((e) => /link ID/i.test(e))}
              {...field('id')}
              onChange={(e) => {
                setIdTouched(true);
                update({ id: e.target.value.toLowerCase() });
              }}
            />
            <p className="hint break-all">
              {mode === 'edit' ? 'Can’t be changed after publishing (links in sent emails would break): ' : 'Becomes part of the link: '}
              <code className="rounded bg-sk-gray-100 px-1">{link}</code>
            </p>
          </div>

          {serverError && <div className="msg msg-error" role="alert">{serverError}</div>}
          {showErrors && errors.length > 0 && (
            <div className="msg msg-error" role="alert"><ul className="list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>
          )}
          {warnings.length > 0 && (
            <div className="msg msg-warn" role="status"><ul className="list-disc pl-4">{warnings.map((w) => <li key={w}>{w}</li>)}</ul></div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className="btn btn-primary min-h-12 px-6 text-base" type="submit" disabled={pending}>
              {pending ? 'Publishing …' : mode === 'edit' ? 'Publish changes' : 'Publish'}
            </button>
            {mode === 'edit' && <span className="text-xs text-sk-gray-600">The link stays the same. Changes are live immediately.</span>}
          </div>
        </form>

        <aside className="panel lg:sticky lg:top-4">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <strong>Live preview</strong>
            <div className="flex gap-2">
              <select className="input min-h-8 w-auto py-1 text-xs" aria-label="Preview device" value={previewPlatform} onChange={(e) => setPreviewPlatform(e.target.value)}>
                <option value="ios">iPhone (Safari)</option>
                <option value="ios-inapp">iPhone (in-app)</option>
                <option value="android">Android</option>
                <option value="windows">Windows</option>
                <option value="macos">Mac</option>
              </select>
              <select className="input min-h-8 w-auto py-1 text-xs" aria-label="Preview language" value={previewLang} onChange={(e) => setPreviewLang(e.target.value as 'de' | 'en')}>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
          <iframe ref={frame} src="/preview" title="Recipient page preview" className="mx-auto block h-[720px] w-full max-w-[400px] rounded-3xl border border-sk-gray-300 bg-sk-gray-50" />
          <p className="hint">Buttons in the preview work, so you can test the calendar entries before publishing. Preview clicks are not tracked.</p>
        </aside>
      </div>
    </>
  );
}
