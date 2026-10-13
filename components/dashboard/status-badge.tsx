import type { CalendarEvent } from '@/lib/calendar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type EventStatus = 'live' | 'upcoming' | 'past' | 'archived';

/** Archived wins; otherwise live while running, upcoming before the start, past after the end. */
export function eventStatus(e: Pick<CalendarEvent, 'archived' | 'startUtc' | 'endUtc'>, now = new Date()): EventStatus {
  if (e.archived) return 'archived';
  const time = now.getTime();
  if (new Date(e.endUtc).getTime() <= time) return 'past';
  if (new Date(e.startUtc).getTime() <= time) return 'live';
  return 'upcoming';
}

const STATUS: Record<EventStatus, { label: string; variant: 'outline' | 'secondary'; className?: string }> = {
  live: { label: 'Live', variant: 'outline', className: 'border-success/20 bg-success/10 text-success' },
  upcoming: { label: 'Upcoming', variant: 'outline', className: 'border-info/20 bg-info/10 text-info' },
  past: { label: 'Past', variant: 'secondary' },
  archived: { label: 'Archived', variant: 'outline' },
};

export function StatusBadge({ status, className }: { status: EventStatus; className?: string }) {
  const { label, variant, className: tint } = STATUS[status];
  return (
    <Badge variant={variant} className={cn(tint, className)}>
      {label}
    </Badge>
  );
}
