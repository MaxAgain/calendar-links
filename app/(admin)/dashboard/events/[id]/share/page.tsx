import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShareLink } from '@/components/admin/ShareLink';
import { requireStaffPage } from '@/lib/auth';
import { ID_PATTERN } from '@/lib/calendar';
import { getEvent } from '@/lib/events';
import { formatEventDate } from '@/lib/format';
import { eventLink } from '@/lib/site';

export default async function ShareEventPage({ params }: PageProps<'/dashboard/events/[id]/share'>) {
  await requireStaffPage();
  const { id } = await params;
  const event = ID_PATTERN.test(id) ? await getEvent(id) : null;
  if (!event) notFound();
  const link = eventLink(event.id);

  return (
    <div className="panel mx-auto max-w-3xl">
      <div className="msg msg-ok mb-4" role="status"><strong>Published ✓</strong> The link works right away.</div>
      <h1 className="mb-1 text-xl font-bold">{event.title}</h1>
      <p className="mb-5 text-sm text-sk-gray-600">{formatEventDate(event)}</p>
      <ShareLink baseLink={link} />
      <ol className="mb-5 list-decimal space-y-1 pl-5">
        <li>In Klaviyo, add a <strong>Button</strong> block (e.g. “Zum Kalender hinzufügen”).</li>
        <li>Paste the link as the button’s link address.</li>
        <li>Send a test email to yourself and click the button on your phone.</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <a className="btn" href={`/e/${event.id}`} target="_blank" rel="noopener">Open recipient page</a>
        <Link className="btn" href={`/dashboard/events/${event.id}`}>Edit</Link>
        <Link className="btn" href="/dashboard">Back to events</Link>
      </div>
    </div>
  );
}
