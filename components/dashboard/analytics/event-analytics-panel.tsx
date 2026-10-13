import { TagIcon } from 'lucide-react';
import { AnalyticsCard } from '@/components/dashboard/analytics/analytics-card';
import { BarList } from '@/components/dashboard/analytics/bar-list';
import { DeltaBadge } from '@/components/dashboard/analytics/delta-badge';
import { KpiCard, KpiGrid } from '@/components/dashboard/analytics/kpi-card';
import { comparisonLabel } from '@/components/dashboard/analytics/labels';
import { ViewsAddsChart } from '@/components/dashboard/analytics/views-adds-chart';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { EventAnalytics } from '@/lib/analytics';
import { CALENDAR_LABELS, DEVICE_LABELS, LANGUAGE_LABELS, OS_LABELS, formatNumber, formatPercent } from '@/lib/format';

const PROGRESS_CLASS = 'h-2 *:data-[slot=progress-indicator]:bg-chart-1';

/** All analytics for one event: KPIs, daily chart, calendar/OS/device/language splits, UTM table. */
export function EventAnalyticsPanel({ analytics }: { analytics: EventAnalytics }) {
  const { totals, previous, range } = analytics;
  const note = comparisonLabel(range);

  const calendarAdds = analytics.calendars.reduce((sum, c) => sum + c.adds, 0);
  const recommendedAdds = analytics.calendars.reduce((sum, c) => sum + c.recommended, 0);
  const recommendedShare = calendarAdds > 0 ? recommendedAdds / calendarAdds : 0;

  const inAppViews = analytics.inApp.inApp + analytics.inApp.browser;
  const inAppShare = inAppViews > 0 ? analytics.inApp.inApp / inAppViews : 0;

  return (
    <div className="flex flex-col gap-6">
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
          title="Unique visits"
          value={formatNumber(totals.sessions)}
          delta={<DeltaBadge current={totals.sessions} previous={previous?.sessions} />}
          note={previous ? note : 'Distinct sessions'}
        />
      </KpiGrid>

      <AnalyticsCard title="Views and calendar adds" description="Per day, in UTC.">
        <ViewsAddsChart data={analytics.daily} label="Daily page views and calendar adds" />
      </AnalyticsCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsCard
          title="Calendars"
          description={
            calendarAdds > 0
              ? `${formatPercent(recommendedShare, 0)} of adds came from the recommended button.`
              : 'Which calendar people chose.'
          }
        >
          <div className="flex flex-col gap-4">
            <BarList
              label="Calendar adds by calendar"
              unit="adds"
              emptyText="No calendar adds in this period."
              items={analytics.calendars.map((c) => ({
                key: c.calendar,
                label: CALENDAR_LABELS[c.calendar] ?? c.calendar,
                value: c.adds,
                highlight: c.recommended,
              }))}
            />
            {calendarAdds > 0 ? (
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-chart-1" />
                  Recommended button
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-chart-1/35" />
                  Other
                </span>
              </p>
            ) : null}
          </div>
        </AnalyticsCard>

        <AnalyticsCard title="Devices" description="Page views by operating system and device type.">
          <Tabs defaultValue="os">
            <TabsList>
              <TabsTrigger value="os">System</TabsTrigger>
              <TabsTrigger value="device">Device</TabsTrigger>
            </TabsList>
            <TabsContent value="os" className="pt-2">
              <BarList
                label="Page views by operating system"
                unit="views"
                items={analytics.os.map((o) => ({ key: o.key, label: OS_LABELS[o.key] ?? o.key, value: o.views }))}
              />
            </TabsContent>
            <TabsContent value="device" className="pt-2">
              <BarList
                label="Page views by device type"
                unit="views"
                items={analytics.devices.map((d) => ({ key: d.key, label: DEVICE_LABELS[d.key] ?? d.key, value: d.views }))}
              />
            </TabsContent>
          </Tabs>
        </AnalyticsCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AnalyticsCard title="Opened in" description="Where the page was opened.">
          <div className="flex flex-col gap-3">
            <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
              {formatPercent(inAppShare, 0)}
              <span className="ml-2 font-sans text-sm font-normal tracking-normal text-muted-foreground">in an in-app browser</span>
            </p>
            <Progress value={inAppShare * 100} aria-label="Share of views in an in-app browser" className={PROGRESS_CLASS} />
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">In-app browser</dt>
                <dd className="font-mono tabular-nums">{formatNumber(analytics.inApp.inApp)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Regular browser</dt>
                <dd className="font-mono tabular-nums">{formatNumber(analytics.inApp.browser)}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              In-app browsers (Gmail, Instagram…) can’t always add to calendar directly. Visitors there may need to open the page in their own browser first.
            </p>
          </div>
        </AnalyticsCard>

        <AnalyticsCard title="Recommended button" description="Adds through the button suggested for the visitor’s device.">
          <div className="flex flex-col gap-3">
            <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">{formatPercent(recommendedShare, 0)}</p>
            <Progress value={recommendedShare * 100} aria-label="Share of adds through the recommended button" className={PROGRESS_CLASS} />
            <p className="text-sm text-muted-foreground">
              {calendarAdds > 0
                ? `${formatNumber(recommendedAdds)} of ${formatNumber(calendarAdds)} adds used the recommended button.`
                : 'No calendar adds in this period.'}
            </p>
          </div>
        </AnalyticsCard>

        <AnalyticsCard title="Languages" description="Page views by browser language." className="md:col-span-2 xl:col-span-1">
          <BarList
            label="Page views by language"
            unit="views"
            items={analytics.languages.map((l) => ({ key: l.key, label: LANGUAGE_LABELS[l.key] ?? l.key, value: l.views }))}
          />
        </AnalyticsCard>
      </div>

      <AnalyticsCard title="UTM sources" description="Campaign tags on the link, from your emails and posts." contentClassName="px-0">
        {analytics.utm.length === 0 ? (
          <div className="px-(--card-spacing)">
            <Empty className="border py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <TagIcon />
                </EmptyMedia>
                <EmptyTitle>No tagged visits</EmptyTitle>
                <EmptyDescription>Add utm_source, utm_medium and utm_campaign to the link to see which email or post brought people here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <Table>
            <TableCaption className="sr-only">Page views and calendar adds by UTM tags</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-(--card-spacing)">Source</TableHead>
                <TableHead>Medium</TableHead>
                <TableHead className="hidden sm:table-cell">Campaign</TableHead>
                <TableHead className="hidden lg:table-cell">Content</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Adds</TableHead>
                <TableHead className="pr-(--card-spacing) text-right">Add rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.utm.map((row) => (
                <TableRow key={`${row.source}|${row.medium}|${row.campaign}|${row.content}`}>
                  <TableCell className="pl-(--card-spacing) font-medium">{row.source || '—'}</TableCell>
                  <TableCell>{row.medium || '—'}</TableCell>
                  <TableCell className="hidden max-w-48 truncate sm:table-cell">{row.campaign || '—'}</TableCell>
                  <TableCell className="hidden max-w-48 truncate lg:table-cell">{row.content || '—'}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatNumber(row.views)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatNumber(row.adds)}</TableCell>
                  <TableCell className="pr-(--card-spacing) text-right font-mono tabular-nums">
                    {row.views > 0 ? formatPercent(row.adds / row.views) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AnalyticsCard>
    </div>
  );
}
