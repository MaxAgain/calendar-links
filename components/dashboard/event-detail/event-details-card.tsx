import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CalendarEvent } from '@/lib/calendar';
import { formatDateTime, formatEventDate } from '@/lib/format';

function reminderLabel(minutes: number | null): string {
  if (!minutes) return 'None';
  if (minutes === 1440) return '1 day before';
  if (minutes % 1440 === 0) return `${minutes / 1440} days before`;
  if (minutes === 60) return '1 hour before';
  if (minutes % 60 === 0) return `${minutes / 60} hours before`;
  return `${minutes} minutes before`;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

export function EventDetailsCard({ event }: { event: CalendarEvent }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Event details</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="flex flex-col divide-y divide-border text-sm">
          <Row label="Title">{event.title}</Row>
          <Row label="Description">
            {event.description ? <span className="whitespace-pre-wrap break-words">{event.description}</span> : '—'}
          </Row>
          <Row label="Date and time">{formatEventDate(event)}</Row>
          <Row label="Time zone">{event.timezone}</Row>
          <Row label="All-day">{event.allDay ? 'Yes' : 'No'}</Row>
          <Row label="Location">{event.location || '—'}</Row>
          <Row label="Online link">
            {event.url ? (
              <a href={event.url} target="_blank" rel="noopener noreferrer" className="break-all text-link underline-offset-4 hover:underline">
                {event.url}
              </a>
            ) : (
              '—'
            )}
          </Row>
          <Row label="Reminder">{reminderLabel(event.reminderMinutes)}</Row>
          <Row label="Link ID"><span className="font-mono">{event.id}</span></Row>
          <Row label="Calendar UID"><span className="font-mono break-all">{event.uid}</span></Row>
          <Row label="Version">{event.sequence}</Row>
          <Row label="Created">{formatDateTime(event.createdAt)}</Row>
          <Row label="Last updated">{formatDateTime(event.updatedAt)}</Row>
        </dl>
        <p className="text-sm text-muted-foreground">
          Edits keep the same link. Calendars that already added the event don’t update automatically.
        </p>
      </CardContent>
    </Card>
  );
}
