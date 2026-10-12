import Link from 'next/link';
import { ArchiveButton } from '@/components/admin/ArchiveButton';
import { CopyButton } from '@/components/admin/CopyButton';
import { requireStaffPage } from '@/lib/auth';
import { isPast, type CalendarEvent } from '@/lib/calendar';
import { getStats, listEvents, type EventStats } from '@/lib/events';
import { CALENDAR_LABELS, formatEventDate } from '@/lib/format';
import { eventLink } from '@/lib/site';

function StatusBadge({ event }: { event: CalendarEvent }) {
  const [label, cls] = event.archived
    ? ['Archived', 'border-sk-gray-400 bg-sk-white text-sk-gray-600']
    : isPast(event)
      ? ['Past', 'border-sk-gray-300 bg-sk-gray-100 text-sk-gray-600']
      : ['Upcoming', 'border-green-200 bg-green-50 text-green-800'];
  return <span className={`ml-2 inline-block rounded-full border px-2 py-px align-middle text-xs font-bold ${cls}`}>{label}</span>;
}

function Stats({ stats }: { stats?: EventStats }) {
  if (!stats || (!stats.views && !stats.adds)) return <p className="text-sm text-sk-gray-600">No clicks yet.</p>;
  const rate = stats.views ? Math.round((stats.adds / stats.views) * 100) : 0;
  const calendars = Object.entries(stats.calendars).sort((a, b) => b[1] - a[1]);
  const max = calendars[0]?.[1] || 1;
  return (
    <div className="text-sm">
      <div className="mb-1.5 flex flex-wrap gap-x-4 gap-y-1">
        <span><strong className="text-base">{stats.views}</strong> views</span>
        <span><strong className="text-base">{stats.adds}</strong> adds</span>
        <span><strong className="text-base">{rate}%</strong> add rate</span>
      </div>
      <div className="grid gap-1">
        {calendars.map(([calendar, n], i) => (
          <div key={calendar} className="grid grid-cols-[110px_1fr_36px] items-center gap-2 text-xs text-sk-gray-600">
            <span>{CALENDAR_LABELS[calendar] ?? calendar}</span>
            <span className="h-2 overflow-hidden rounded bg-sk-gray-100">
              <span className={`block h-full rounded ${i === 0 ? 'bg-sk-yellow-400' : 'bg-sk-blue-600'}`} style={{ width: `${Math.max(4, (n / max) * 100)}%` }} />
            </span>
            <span className="text-right text-sk-gray-800">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-sk-gray-200 bg-sk-white px-4 py-3">
      <div className="text-xs text-sk-gray-600">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<'/dashboard'>) {
  await requireStaffPage();
  const showArchived = (await searchParams).archived === '1';
  const [events, stats] = await Promise.all([listEvents(), getStats()]);
  const visible = events.filter((e) => showArchived || !e.archived);
  const { views, adds, notFound } = stats.totals;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Events</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn" href={showArchived ? '/dashboard' : '/dashboard?archived=1'}>
            {showArchived ? 'Hide archived' : 'Show archived'}
          </Link>
          <Link className="btn btn-primary" href="/dashboard/events/new">+ New event</Link>
        </div>
      </div>

      {views + adds > 0 && (
        <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
          <Tile label="Page views" value={views} />
          <Tile label="Added to calendar" value={adds} />
          <Tile label="Add rate" value={`${views ? Math.round((adds / views) * 100) : 0}%`} />
          {notFound > 0 && <Tile label="Broken link clicks" value={notFound} />}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="panel py-10 text-center">
          <p className="mb-3">{events.length ? 'Only archived events exist.' : 'No events yet.'}</p>
          <Link className="btn btn-primary" href="/dashboard/events/new">+ Create an event</Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {visible.map((event) => (
            <article key={event.id} className={`grid gap-3 rounded-xl border border-sk-gray-200 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] ${event.archived ? 'bg-sk-gray-100' : 'bg-sk-white'}`}>
              <div className="min-w-0">
                <h2 className="mb-1 break-words text-base font-bold">
                  {event.title}
                  <StatusBadge event={event} />
                </h2>
                <p className="text-sm text-sk-gray-600">{formatEventDate(event)}</p>
                <p className="break-all text-sm text-sk-gray-600">
                  Link: <code className="rounded bg-sk-gray-100 px-1.5 py-px text-xs">{eventLink(event.id)}</code>
                </p>
              </div>
              <Stats stats={stats.byEvent[event.id]} />
              <div className="flex flex-wrap gap-1.5 border-t border-sk-gray-200 pt-2.5 lg:col-span-2">
                <CopyButton text={eventLink(event.id)} />
                <a className="btn btn-sm" href={`/e/${event.id}`} target="_blank" rel="noopener">Open</a>
                <Link className="btn btn-sm" href={`/dashboard/events/${event.id}`}>Edit</Link>
                <Link className="btn btn-sm" href={`/dashboard/events/new?from=${event.id}`}>Duplicate</Link>
                <ArchiveButton id={event.id} title={event.title} archived={event.archived} />
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
