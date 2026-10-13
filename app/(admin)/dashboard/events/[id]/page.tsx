import { ArchiveIcon, ExternalLinkIcon, MapPinIcon, PencilIcon } from 'lucide-react';
import { notFound } from 'next/navigation';
import { EventAnalyticsPanel } from '@/components/dashboard/analytics/event-analytics-panel';
import { RangeToggle } from '@/components/dashboard/analytics/range-toggle';
import { CopyButton } from '@/components/dashboard/copy-button';
import { EventActionsMenu } from '@/components/dashboard/event-actions-menu';
import { EventDetailsCard } from '@/components/dashboard/event-detail/event-details-card';
import { EventTabs } from '@/components/dashboard/event-detail/event-tabs';
import { EVENT_TABS, type EventTab } from '@/components/dashboard/event-detail/tabs';
import { SharePanel } from '@/components/dashboard/event-detail/share-panel';
import { PreviewPanel } from '@/components/dashboard/event-editor/preview-panel';
import { GuardedLink } from '@/components/dashboard/navigation-guard';
import { PageHeader } from '@/components/dashboard/page-header';
import { eventStatus, StatusBadge } from '@/components/dashboard/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getEventAnalytics, parseRange } from '@/lib/analytics';
import { requireStaffPage } from '@/lib/auth';
import { ID_PATTERN } from '@/lib/calendar';
import { getEvent } from '@/lib/events';
import { formatEventDate } from '@/lib/format';
import { eventLink } from '@/lib/site';

export default async function EventDetailPage({ params, searchParams }: PageProps<'/dashboard/events/[id]'>) {
  await requireStaffPage();
  const { id } = await params;
  const event = ID_PATTERN.test(id) ? await getEvent(id) : null;
  if (!event) notFound();

  const sp = await searchParams;
  const requestedTab = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab: EventTab = EVENT_TABS.find((t) => t === requestedTab) ?? 'overview';
  const range = parseRange(sp.range);
  const analytics = await getEventAnalytics(event, range);
  const link = eventLink(event.id);
  const status = eventStatus(event);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {event.title}
            <StatusBadge status={status} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>{formatEventDate(event)}</span>
            {event.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="size-3.5" aria-hidden />
                {event.location}
              </span>
            ) : null}
          </span>
        }
        actions={
          <>
            <CopyButton text={link} />
            <Button variant="outline" asChild>
              {/* A plain anchor: recipient pages are reached by a full page load. */}
              <a href={`/e/${event.id}`} target="_blank" rel="noopener">
                <ExternalLinkIcon />
                Open page
              </a>
            </Button>
            <Button variant="outline" asChild>
              <GuardedLink href={`/dashboard/events/${event.id}/edit`}>
                <PencilIcon />
                Edit
              </GuardedLink>
            </Button>
            <EventActionsMenu event={{ id: event.id, title: event.title, archived: event.archived }} link={link} />
          </>
        }
      />

      {event.archived && (
        <Alert>
          <ArchiveIcon />
          <AlertDescription>
            This event is archived. People who open the link see “event not available”. Restore it from the actions menu.
          </AlertDescription>
        </Alert>
      )}

      <EventTabs
        tab={tab}
        overview={
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">How people use the link to this event.</p>
              <RangeToggle value={range} />
            </div>
            <EventAnalyticsPanel analytics={analytics} />
          </>
        }
        share={<SharePanel eventId={event.id} baseLink={link} />}
        details={
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
            <EventDetailsCard event={event} />
            <PreviewPanel
              draft={event}
              title="Event card"
              description="What recipients see when they open the link. Preview clicks are not tracked."
            />
          </div>
        }
      />
    </>
  );
}
