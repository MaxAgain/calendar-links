import { ArrowRightIcon, CalendarPlusIcon, PlusIcon } from 'lucide-react';
import { AnalyticsCard } from '@/components/dashboard/analytics/analytics-card';
import { BarList } from '@/components/dashboard/analytics/bar-list';
import { DeltaBadge } from '@/components/dashboard/analytics/delta-badge';
import { KpiCard, KpiGrid } from '@/components/dashboard/analytics/kpi-card';
import { comparisonLabel } from '@/components/dashboard/analytics/labels';
import { RangeToggle } from '@/components/dashboard/analytics/range-toggle';
import { ViewsAddsChart } from '@/components/dashboard/analytics/views-adds-chart';
import { GuardedLink } from '@/components/dashboard/navigation-guard';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatusBadge, eventStatus } from '@/components/dashboard/status-badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { getOverviewAnalytics, parseRange } from '@/lib/analytics';
import { requireStaffPage } from '@/lib/auth';
import { listEvents } from '@/lib/events';
import { CALENDAR_LABELS, formatEventDate, formatNumber, formatPercent } from '@/lib/format';

export default async function OverviewPage({ searchParams }: PageProps<'/dashboard'>) {
  await requireStaffPage();
  const range = parseRange((await searchParams).range);
  const events = await listEvents();

  const header = (actions?: boolean) => (
    <PageHeader
      title="Overview"
      description="How your event links perform across all emails."
      actions={
        actions ? (
          <>
            <RangeToggle value={range} />
            <Button asChild>
              <GuardedLink href="/dashboard/events/new">
                <PlusIcon />
                New event
              </GuardedLink>
            </Button>
          </>
        ) : undefined
      }
    />
  );

  if (events.length === 0) {
    return (
      <>
        {header(false)}
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarPlusIcon />
            </EmptyMedia>
            <EmptyTitle>No events yet</EmptyTitle>
            <EmptyDescription>Create an event to get a link for your next Klaviyo email.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <GuardedLink href="/dashboard/events/new">
                <PlusIcon />
                Create an event
              </GuardedLink>
            </Button>
          </EmptyContent>
        </Empty>
      </>
    );
  }

  const now = new Date();
  const overview = await getOverviewAnalytics(events, range, now);
  const { totals, previous } = overview;
  const note = comparisonLabel(range);

  const upcoming = events
    .filter((e) => {
      const status = eventStatus(e, now);
      return status === 'live' || status === 'upcoming';
    })
    .sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime());
  const next = upcoming[0];
  const titles = new Map(events.map((e) => [e.id, e.title]));

  return (
    <>
      {header(true)}

      <KpiGrid>
        <KpiCard
          title="Page views"
          value={formatNumber(totals.views)}
          delta={<DeltaBadge current={totals.views} previous={previous?.views} />}
          note={previous ? note : undefined}
        />
        <KpiCard
          title="Calendar adds"
          value={formatNumber(totals.adds)}
          delta={<DeltaBadge current={totals.adds} previous={previous?.adds} />}
          note={previous ? note : undefined}
        />
        <KpiCard
          title="Add rate"
          value={formatPercent(totals.addRate)}
          delta={<DeltaBadge mode="points" current={totals.addRate} previous={previous?.addRate} />}
          note={previous ? `${note}, in percentage points` : 'Adds divided by views'}
        />
        <KpiCard
          sample={false}
          title="Upcoming events"
          value={formatNumber(upcoming.length)}
          note={
            <span className="block truncate">{next ? `Next: ${next.title} · ${formatEventDate(next)}` : 'None scheduled'}</span>
          }
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <AnalyticsCard
          className="lg:col-span-2"
          title="Views and calendar adds"
          description="Per day, across all events."
          footer={
            overview.notFound > 0
              ? `${formatNumber(overview.notFound)} visits to broken or mistyped links in this period.`
              : undefined
          }
        >
          <ViewsAddsChart data={overview.daily} label="Daily page views and calendar adds across all events" />
        </AnalyticsCard>

        <AnalyticsCard title="Calendars" description="Where people added events.">
          <BarList
            label="Calendar adds by calendar"
            unit="adds"
            emptyText="No calendar adds in this period."
            items={overview.calendars.map((c) => ({ key: c.calendar, label: CALENDAR_LABELS[c.calendar] ?? c.calendar, value: c.adds }))}
          />
        </AnalyticsCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsCard
          sample={false}
          title="Upcoming events"
          description="Live now and next in line."
          footer={
            <GuardedLink
              href="/dashboard/events?tab=upcoming"
              className="inline-flex items-center gap-1 text-sm font-medium text-link underline-offset-4 hover:underline"
            >
              View all events
              <ArrowRightIcon className="size-3.5" aria-hidden />
            </GuardedLink>
          }
          contentClassName="px-2"
        >
          {upcoming.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">No upcoming events. Create one to get a new link.</p>
          ) : (
            <ul className="flex flex-col">
              {upcoming.slice(0, 5).map((event) => (
                <li key={event.id}>
                  <GuardedLink
                    href={`/dashboard/events/${event.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{event.title}</span>
                      <span className="truncate text-xs text-muted-foreground">{formatEventDate(event)}</span>
                    </span>
                    <StatusBadge status={eventStatus(event, now)} />
                  </GuardedLink>
                </li>
              ))}
            </ul>
          )}
        </AnalyticsCard>

        <AnalyticsCard title="Top events" description="Most calendar adds in this period.">
          {overview.topEvents.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No calendar adds in this period yet.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-border" aria-label="Top events by calendar adds">
              {overview.topEvents.map((top, index) => (
                <li key={top.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  <span className="w-5 shrink-0 text-sm text-muted-foreground tabular-nums">{index + 1}</span>
                  <GuardedLink
                    href={`/dashboard/events/${top.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {titles.get(top.id) ?? top.id}
                  </GuardedLink>
                  <span className="shrink-0 text-right text-sm tabular-nums">
                    <span className="font-mono font-medium">{formatNumber(top.adds)}</span>
                    <span className="sr-only"> adds, </span>
                    <span className="ml-2 inline-block w-14 text-xs text-muted-foreground">{formatPercent(top.addRate)}</span>
                    <span className="sr-only"> add rate</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </AnalyticsCard>
      </div>
    </>
  );
}
