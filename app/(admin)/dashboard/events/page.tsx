import { PlusIcon } from 'lucide-react';
import { RangeToggle } from '@/components/dashboard/analytics/range-toggle';
import { rangeLabel } from '@/components/dashboard/analytics/labels';
import { EventsTable, type EventRow } from '@/components/dashboard/events-table';
import { GuardedLink } from '@/components/dashboard/navigation-guard';
import { PageHeader } from '@/components/dashboard/page-header';
import { eventStatus } from '@/components/dashboard/status-badge';
import { Button } from '@/components/ui/button';
import { getOverviewAnalytics, parseRange } from '@/lib/analytics';
import { requireStaffPage } from '@/lib/auth';
import { listEvents } from '@/lib/events';
import { formatEventDate } from '@/lib/format';
import { eventLink } from '@/lib/site';

const TABS = ['all', 'upcoming', 'past', 'archived'] as const;

export default async function EventsPage({ searchParams }: PageProps<'/dashboard/events'>) {
  await requireStaffPage();
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab = TABS.find((t) => t === tabParam) ?? 'all';

  const events = await listEvents();
  const now = new Date();
  const overview = await getOverviewAnalytics(events, range, now);

  const rows: EventRow[] = events.map((e) => {
    const stats = overview.byEvent[e.id];
    return {
      id: e.id,
      title: e.title,
      dateLabel: formatEventDate(e),
      startUtc: e.startUtc,
      status: eventStatus(e, now),
      archived: e.archived,
      link: eventLink(e.id),
      views: stats?.views ?? 0,
      adds: stats?.adds ?? 0,
      addRate: stats?.addRate ?? 0,
    };
  });

  return (
    <>
      <PageHeader
        title="Events"
        description="Every event link, with performance for the selected period."
        actions={
          <>
            <RangeToggle value={range} />
            <Button asChild>
              <GuardedLink href="/dashboard/events/new">
                <PlusIcon />
                New event
              </GuardedLink>
            </Button>
          </>
        }
      />
      <EventsTable rows={rows} initialTab={tab} rangeLabel={rangeLabel(range)} />
    </>
  );
}
