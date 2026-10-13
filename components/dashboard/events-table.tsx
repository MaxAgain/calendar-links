'use client';

import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, CalendarPlusIcon, PlusIcon, SearchIcon, SearchXIcon, XIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useOptimistic, useState, useTransition, type MouseEvent } from 'react';
import { EventActionsMenu } from '@/components/dashboard/event-actions-menu';
import { GuardedLink } from '@/components/dashboard/navigation-guard';
import { SampleBadge } from '@/components/dashboard/sample-badge';
import { StatusBadge, type EventStatus } from '@/components/dashboard/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ANALYTICS_SAMPLE } from '@/lib/analytics';
import { formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface EventRow {
  id: string;
  title: string;
  dateLabel: string;
  startUtc: string;
  status: EventStatus;
  archived: boolean;
  /** Full recipient URL. */
  link: string;
  views: number;
  adds: number;
  addRate: number;
}

type Tab = 'all' | 'upcoming' | 'past' | 'archived';
type SortKey = 'date' | 'adds';
type SortDir = 'asc' | 'desc';

const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'archived', label: 'Archived' },
];

const EMPTY_TAB_TEXT: Record<Tab, string> = {
  all: 'No events yet.',
  upcoming: 'No upcoming events. Events show up here until they end.',
  past: 'No past events yet.',
  archived: 'No archived events. Archive an event to hide it from the main list.',
};

const parseTab = (value: string | null | undefined, fallback: Tab): Tab => TABS.find((t) => t.value === value)?.value ?? fallback;

function inTab(row: EventRow, tab: Tab): boolean {
  switch (tab) {
    case 'all':
      return !row.archived;
    case 'upcoming':
      return row.status === 'live' || row.status === 'upcoming';
    case 'past':
      return row.status === 'past';
    case 'archived':
      return row.archived;
  }
}

function SortButton({
  label,
  active,
  dir,
  align = 'left',
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  align?: 'left' | 'right';
  onClick: () => void;
}) {
  const Icon = !active ? ArrowUpDownIcon : dir === 'asc' ? ArrowUpIcon : ArrowDownIcon;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn('-mx-2 font-medium', align === 'right' && 'flex-row-reverse')}
      aria-label={`Sort by ${label.toLowerCase()}`}
    >
      {label}
      <Icon className={cn(!active && 'text-muted-foreground')} aria-hidden />
    </Button>
  );
}

export function EventsTable({ rows, initialTab, rangeLabel }: { rows: EventRow[]; initialTab: Tab; rangeLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // The URL is the source of truth for the tab; the optimistic value makes the switch instant.
  const [tab, setTab] = useOptimistic(parseTab(searchParams.get('tab'), initialTab));
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);

  const counts = useMemo(() => {
    const result: Record<Tab, number> = { all: 0, upcoming: 0, past: 0, archived: 0 };
    for (const row of rows) for (const t of TABS) if (inTab(row, t.value)) result[t.value] += 1;
    return result;
  }, [rows]);

  // Upcoming events read best soonest first; everything else newest first.
  const effective = sort ?? { key: 'date' as const, dir: tab === 'upcoming' ? ('asc' as const) : ('desc' as const) };

  const normalized = query.trim().toLowerCase();
  const visible = useMemo(() => {
    const filtered = rows.filter(
      (row) => inTab(row, tab) && (!normalized || row.title.toLowerCase().includes(normalized) || row.id.toLowerCase().includes(normalized)),
    );
    const factor = effective.dir === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => {
      const diff =
        effective.key === 'adds' ? a.adds - b.adds : new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime();
      return diff !== 0 ? diff * factor : a.title.localeCompare(b.title);
    });
  }, [rows, tab, normalized, effective.key, effective.dir]);

  function changeTab(next: string) {
    const value = parseTab(next, tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    startTransition(() => {
      setTab(value);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function toggleSort(key: SortKey) {
    setSort(
      effective.key === key
        ? { key, dir: effective.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'date' && tab === 'upcoming' ? 'asc' : 'desc' },
    );
  }

  function openRow(event: MouseEvent<HTMLTableRowElement>, id: string) {
    // Links and buttons inside the row handle their own clicks.
    if ((event.target as HTMLElement).closest('a, button')) return;
    router.push(`/dashboard/events/${id}`);
  }

  if (rows.length === 0) {
    return (
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
    );
  }

  const ariaSort = (key: SortKey) => (effective.key === key ? (effective.dir === 'asc' ? 'ascending' : 'descending') : 'none');

  return (
    <Tabs value={tab} onValueChange={changeTab} className="gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-full overflow-x-auto">
          <TabsList className="w-full sm:w-fit">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="px-2.5">
                {t.label}
                <span className="text-xs text-muted-foreground tabular-nums">{counts[t.value]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Stats: {rangeLabel.toLowerCase()}</span>
            {ANALYTICS_SAMPLE ? <SampleBadge /> : null}
          </div>
          <InputGroup className="w-full sm:w-64">
            <InputGroupAddon>
              <SearchIcon aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events"
              aria-label="Search events by title or link ID"
              autoComplete="off"
              className="[&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => setQuery('')}>
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        </div>
      </div>

      <TabsContent value={tab} className="flex flex-col">
        <Card className="gap-0 py-0">
          {visible.length === 0 ? (
            normalized ? (
              <Empty className="border-0 py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <SearchXIcon />
                  </EmptyMedia>
                  <EmptyTitle>No events match “{query.trim()}”</EmptyTitle>
                  <EmptyDescription>Check the spelling, or search for part of the title or link ID.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={() => setQuery('')}>
                    Clear search
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">{EMPTY_TAB_TEXT[tab]}</p>
            )
          ) : (
            <Table>
              <TableCaption className="sr-only">
                Events with page views, calendar adds and add rate for {rangeLabel.toLowerCase()}
              </TableCaption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Event</TableHead>
                  <TableHead className="hidden md:table-cell" aria-sort={ariaSort('date')}>
                    <SortButton label="Date" active={effective.key === 'date'} dir={effective.dir} onClick={() => toggleSort('date')} />
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden text-right md:table-cell">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-4">
                          Views
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Page views · {rangeLabel}</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="text-right" aria-sort={ariaSort('adds')}>
                    <SortButton
                      label="Adds"
                      align="right"
                      active={effective.key === 'adds'}
                      dir={effective.dir}
                      onClick={() => toggleSort('adds')}
                    />
                  </TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Add rate</TableHead>
                  <TableHead className="w-12 pr-3">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => (
                  <TableRow key={row.id} onClick={(e) => openRow(e, row.id)} className="cursor-pointer">
                    <TableCell className="min-w-44 py-3 pl-4 whitespace-normal">
                      <div className="flex flex-col gap-0.5">
                        <GuardedLink
                          href={`/dashboard/events/${row.id}`}
                          className="w-fit max-w-full font-medium break-words underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          {row.title}
                        </GuardedLink>
                        <span className="font-mono text-xs break-all text-muted-foreground">/e/{row.id}</span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-xs text-muted-foreground md:hidden">
                          <span className="sm:hidden">
                            <StatusBadge status={row.status} />
                          </span>
                          {row.dateLabel}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-64 text-muted-foreground md:table-cell whitespace-normal">{row.dateLabel}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="hidden text-right font-mono tabular-nums md:table-cell">{formatNumber(row.views)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatNumber(row.adds)}</TableCell>
                    <TableCell className="hidden text-right font-mono tabular-nums lg:table-cell">
                      {row.views > 0 ? formatPercent(row.addRate) : '—'}
                    </TableCell>
                    <TableCell className="pr-3 text-right">
                      <EventActionsMenu event={{ id: row.id, title: row.title, archived: row.archived }} link={row.link} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </TabsContent>
    </Tabs>
  );
}
