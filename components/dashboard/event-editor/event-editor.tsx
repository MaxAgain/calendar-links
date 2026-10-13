'use client';

import { CircleAlertIcon, LoaderCircleIcon, TriangleAlertIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { toast } from 'sonner';
import { saveEventAction } from '@/app/(admin)/dashboard/actions';
import { GuardedLink, useNavigationGuard } from '@/components/dashboard/navigation-guard';
import { PageHeader } from '@/components/dashboard/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  buildEvent, ID_PATTERN, isPast, longestProviderUrl, MAX_SAFE_URL_LENGTH, validateEvent,
  type CalendarEvent,
} from '@/lib/calendar';
import { UID_DOMAIN } from '@/lib/site';
import { DatePicker } from './date-picker';
import {
  allZones, applyChanges, initialState, noopSubscribe, noZones, REMINDER_OPTIONS, toInput,
  type EditorMode, type FormState,
} from './form-state';
import { PreviewPanel } from './preview-panel';
import { TimezoneCombobox } from './timezone-combobox';

interface Props {
  mode: EditorMode;
  /** Event to edit, or template when duplicating. */
  initial?: CalendarEvent | null;
  existingIds: string[];
  siteUrl: string;
  defaultTimezone: string;
}

type FieldName = 'title' | 'description' | 'location' | 'url' | 'startDate' | 'endDate' | 'timezone' | 'reminder' | 'id';

/** Which field a validation message belongs to, so it can be marked `aria-invalid`. */
const ERROR_FIELDS: [RegExp, FieldName][] = [
  [/link ID/i, 'id'],
  [/^Title/, 'title'],
  [/^Description/, 'description'],
  [/^Start/, 'startDate'],
  [/^End/, 'endDate'],
  [/^Time zone/, 'timezone'],
  [/^Location/, 'location'],
  [/^Online link/, 'url'],
  [/^Reminder/, 'reminder'],
];

const NO_REMINDER = 'none';
const ERRORS_ID = 'event-form-errors';

export function EventEditor({ mode, initial, existingIds, siteUrl, defaultTimezone }: Props) {
  const router = useRouter();
  const { setBlocked } = useNavigationGuard();
  const taken = useMemo(() => new Set(existingIds), [existingIds]);
  const [form, setForm] = useState<FormState>(() => initialState(initial, mode, defaultTimezone, taken));
  const [idTouched, setIdTouched] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [serverError, setServerError] = useState('');
  const [pending, startTransition] = useTransition();
  const alertsRef = useRef<HTMLDivElement>(null);
  const zones = useSyncExternalStore(noopSubscribe, allZones, () => noZones);

  // Release the navigation guard when the editor goes away (e.g. after discarding or publishing).
  useEffect(() => () => setBlocked(false), [setBlocked]);

  // Bring the error list into view after a failed publish attempt.
  useEffect(() => {
    if (attempt > 0) alertsRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [attempt]);

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
      warnings.push('The description is very long. Google/Outlook may cut it off, so consider shortening it. (The Apple/.ics version keeps the full text.)');
    }
  }

  const invalidFields = new Set<FieldName>();
  if (showErrors) {
    for (const message of errors) {
      for (const [pattern, name] of ERROR_FIELDS) if (pattern.test(message)) invalidFields.add(name);
    }
    if (!input.title.trim()) invalidFields.add('title');
  }
  const invalid = (name: FieldName) => invalidFields.has(name);
  const describedBy = (name: FieldName) => (invalid(name) ? ERRORS_ID : undefined);

  const update = useCallback(
    (changes: Partial<FormState>) => {
      setBlocked(true);
      setForm((prev) => applyChanges(prev, changes, { mode, idTouched, taken }));
    },
    [mode, idTouched, taken, setBlocked],
  );

  const text = (name: 'title' | 'description' | 'location' | 'url') => ({
    id: `f-${name}`,
    name,
    value: form[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update({ [name]: e.target.value }),
    'aria-invalid': invalid(name) || undefined,
    'aria-describedby': describedBy(name),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    setServerError('');
    if (errors.length) {
      setAttempt((n) => n + 1);
      return;
    }
    startTransition(async () => {
      const result = await saveEventAction(input, mode);
      if (!result.ok) {
        setServerError(result.error);
        setAttempt((n) => n + 1);
        return;
      }
      setBlocked(false);
      toast.success(mode === 'edit' ? 'Changes published' : 'Event published', { description: 'The link works right away.' });
      router.push(`/dashboard/events/${result.id}?tab=share`);
    });
  };

  const duplicating = mode === 'new' && Boolean(initial);
  const title = mode === 'edit' ? 'Edit event' : duplicating ? 'Duplicate event' : 'New event';
  const description =
    mode === 'edit'
      ? 'The link stays the same. Changes are live right after publishing.'
      : 'Fill in the details. The preview shows what recipients see.';
  const cancelHref = mode === 'edit' ? `/dashboard/events/${initial?.id ?? form.id}` : '/dashboard/events';

  const timeInput = (which: 'start' | 'end') => {
    const name = `${which}Time` as const;
    return (
      <Input
        id={`f-${name}`}
        type="time"
        step={300}
        aria-label={`${which === 'start' ? 'Start' : 'End'} time`}
        aria-invalid={invalid(`${which}Date`) || undefined}
        aria-describedby={describedBy(`${which}Date`)}
        className="w-28 flex-none"
        value={form[name]}
        onChange={(e) => update({ [name]: e.target.value })}
      />
    );
  };

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <Button variant="outline" asChild>
              <GuardedLink href={cancelHref}>Cancel</GuardedLink>
            </Button>
            <Button type="submit" form="event-form" disabled={pending}>
              {pending && <LoaderCircleIcon className="animate-spin" />}
              {pending ? 'Publishing…' : mode === 'edit' ? 'Publish changes' : 'Publish'}
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <form id="event-form" className="flex min-w-0 flex-col gap-6" onSubmit={submit} noValidate>
          <div ref={alertsRef} className="flex scroll-mt-20 flex-col gap-3 empty:hidden">
            {serverError && (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertTitle>Could not publish</AlertTitle>
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}
            {showErrors && errors.length > 0 && (
              <Alert variant="destructive" id={ERRORS_ID}>
                <CircleAlertIcon />
                <AlertTitle>Please fix the following</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {errors.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {warnings.length > 0 && (
              <Alert role="status" className="border-warning/30 bg-warning/10 text-warning">
                <TriangleAlertIcon />
                <AlertTitle>Check before publishing</AlertTitle>
                <AlertDescription className="text-warning">
                  <ul className="list-disc pl-4">
                    {warnings.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-invalid={invalid('title') || undefined}>
                  <FieldLabel htmlFor="f-title">
                    Title <span aria-hidden className="text-destructive">*</span>
                  </FieldLabel>
                  <Input type="text" maxLength={200} autoComplete="off" aria-required {...text('title')} />
                </Field>
                <Field data-invalid={invalid('description') || undefined}>
                  <FieldLabel htmlFor="f-description">Description</FieldLabel>
                  <Textarea rows={5} maxLength={3000} {...text('description')} />
                  <FieldDescription>Plain text. Line breaks and links are kept. Shown on the page and in the calendar entry.</FieldDescription>
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field data-invalid={invalid('location') || undefined}>
                    <FieldLabel htmlFor="f-location">Location</FieldLabel>
                    <Input type="text" maxLength={300} placeholder="Address or “Online”" {...text('location')} />
                  </Field>
                  <Field data-invalid={invalid('url') || undefined}>
                    <FieldLabel htmlFor="f-url">Online link</FieldLabel>
                    <Input type="url" maxLength={500} placeholder="https://…" {...text('url')} />
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Date and time</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field orientation="horizontal">
                  <Switch id="f-allDay" checked={form.allDay} onCheckedChange={(checked) => update({ allDay: checked })} />
                  <FieldLabel htmlFor="f-allDay">All-day event</FieldLabel>
                </Field>
                <Field data-invalid={invalid('startDate') || undefined}>
                  <FieldLabel htmlFor="f-startDate">Start</FieldLabel>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <DatePicker id="f-startDate" value={form.startDate} onChange={(startDate) => update({ startDate })} invalid={invalid('startDate')} describedBy={describedBy('startDate')} />
                    </div>
                    {!form.allDay && timeInput('start')}
                  </div>
                </Field>
                <Field data-invalid={invalid('endDate') || undefined}>
                  <FieldLabel htmlFor="f-endDate">End</FieldLabel>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <DatePicker id="f-endDate" value={form.endDate} onChange={(endDate) => update({ endDate })} invalid={invalid('endDate')} describedBy={describedBy('endDate')} />
                    </div>
                    {!form.allDay && timeInput('end')}
                  </div>
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field data-invalid={invalid('timezone') || undefined}>
                    <FieldLabel htmlFor="f-timezone">Time zone</FieldLabel>
                    <TimezoneCombobox id="f-timezone" value={form.timezone} onChange={(timezone) => update({ timezone })} zones={zones} invalid={invalid('timezone')} />
                  </Field>
                  <Field data-invalid={invalid('reminder') || undefined}>
                    <FieldLabel htmlFor="f-reminder">Reminder</FieldLabel>
                    <Select value={form.reminder || NO_REMINDER} onValueChange={(value) => update({ reminder: value === NO_REMINDER ? '' : value })}>
                      <SelectTrigger id="f-reminder" className="w-full" aria-invalid={invalid('reminder') || undefined}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {REMINDER_OPTIONS.map((option) => (
                          <SelectItem key={option.value || NO_REMINDER} value={option.value || NO_REMINDER}>
                            {option.label}
                          </SelectItem>
                        ))}
                        {form.reminder && !REMINDER_OPTIONS.some((option) => option.value === form.reminder) && (
                          <SelectItem value={form.reminder}>{form.reminder} minutes before</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Link</CardTitle>
              <CardDescription>The address you put into your emails.</CardDescription>
            </CardHeader>
            <CardContent>
              <Field data-invalid={invalid('id') || undefined}>
                <FieldLabel htmlFor="f-id">
                  Link ID <span aria-hidden className="text-destructive">*</span>
                </FieldLabel>
                <InputGroup>
                  <InputGroupAddon className="min-w-0 shrink">
                    <InputGroupText className="min-w-0 truncate">{siteUrl}/e/</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="f-id"
                    name="id"
                    type="text"
                    maxLength={64}
                    autoComplete="off"
                    spellCheck={false}
                    readOnly={mode === 'edit'}
                    aria-required
                    aria-invalid={invalid('id') || undefined}
                    aria-describedby={['f-id-hint', describedBy('id')].filter(Boolean).join(' ')}
                    className="min-w-24 font-mono"
                    value={form.id}
                    onChange={(e) => {
                      setIdTouched(true);
                      update({ id: e.target.value.toLowerCase() });
                    }}
                  />
                </InputGroup>
                <FieldDescription id="f-id-hint">
                  {mode === 'edit'
                    ? 'Can’t be changed after publishing, because links in sent emails would break.'
                    : 'Becomes part of the link. It can’t be changed after publishing.'}
                </FieldDescription>
              </Field>
            </CardContent>
          </Card>
        </form>

        <PreviewPanel draft={draft} />
      </div>
    </>
  );
}
