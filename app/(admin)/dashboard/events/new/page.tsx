import { EventEditor } from '@/components/dashboard/event-editor/event-editor';
import { requireStaffPage } from '@/lib/auth';
import { ID_PATTERN } from '@/lib/calendar';
import { getEvent, listEvents } from '@/lib/events';
import { DEFAULT_TIMEZONE, siteUrl } from '@/lib/site';

// /dashboard/events/new?from=<id> duplicates an existing event.
export default async function NewEventPage({ searchParams }: PageProps<'/dashboard/events/new'>) {
  await requireStaffPage();
  const from = (await searchParams).from;
  const [events, template] = await Promise.all([
    listEvents(),
    typeof from === 'string' && ID_PATTERN.test(from) ? getEvent(from) : Promise.resolve(null),
  ]);
  return (
    <EventEditor
      mode="new"
      initial={template}
      existingIds={events.map((e) => e.id)}
      siteUrl={siteUrl()}
      defaultTimezone={DEFAULT_TIMEZONE}
    />
  );
}
