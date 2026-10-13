import { notFound } from 'next/navigation';
import { EventEditor } from '@/components/dashboard/event-editor/event-editor';
import { requireStaffPage } from '@/lib/auth';
import { ID_PATTERN } from '@/lib/calendar';
import { getEvent } from '@/lib/events';
import { DEFAULT_TIMEZONE, siteUrl } from '@/lib/site';

export default async function EditEventPage({ params }: PageProps<'/dashboard/events/[id]/edit'>) {
  await requireStaffPage();
  const { id } = await params;
  const event = ID_PATTERN.test(id) ? await getEvent(id) : null;
  if (!event) notFound();
  return <EventEditor mode="edit" initial={event} existingIds={[]} siteUrl={siteUrl()} defaultTimezone={DEFAULT_TIMEZONE} />;
}
