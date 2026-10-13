'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatDay, formatNumber } from '@/lib/format';
import type { DailyPoint } from '@/lib/analytics';
import { cn } from '@/lib/utils';

const config = {
  views: { label: 'Page views', color: 'var(--chart-1)' },
  adds: { label: 'Calendar adds', color: 'var(--chart-5)' },
} satisfies ChartConfig;

/** Daily page views and calendar adds as two overlapping areas. */
export function ViewsAddsChart({ data, label, className }: { data: DailyPoint[]; label: string; className?: string }) {
  const views = data.reduce((sum, d) => sum + d.views, 0);
  const adds = data.reduce((sum, d) => sum + d.adds, 0);

  if (data.length === 0 || views + adds === 0) {
    return (
      <div className={cn('flex h-64 items-center justify-center rounded-lg bg-muted/50 px-4 text-center text-sm text-muted-foreground', className)}>
        No visits in this period yet.
      </div>
    );
  }

  const peak = data.reduce((best, d) => (d.views > best.views ? d : best), data[0]);
  const summary = `${formatNumber(views)} page views and ${formatNumber(adds)} calendar adds from ${formatDay(data[0].date)} to ${formatDay(data[data.length - 1].date)}. The busiest day was ${formatDay(peak.date)} with ${formatNumber(peak.views)} views.`;

  return (
    <div className={className}>
      <ChartContainer config={config} role="img" aria-label={`${label}. ${summary}`} className="aspect-auto h-64 w-full">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 4 }}>
          <defs>
            {(['views', 'adds'] as const).map((key) => (
              <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={`var(--color-${key})`} stopOpacity={0.35} />
                <stop offset="95%" stopColor={`var(--color-${key})`} stopOpacity={0.03} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={(value: string) => formatDay(value)} />
          <YAxis width={36} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(value: number) => formatNumber(value)} />
          <ChartTooltip content={<ChartTooltipContent indicator="dot" labelFormatter={(value) => formatDay(String(value))} />} />
          <Area dataKey="views" type="monotone" stroke="var(--color-views)" strokeWidth={2} fill="url(#fill-views)" />
          <Area dataKey="adds" type="monotone" stroke="var(--color-adds)" strokeWidth={2} fill="url(#fill-adds)" />
          <ChartLegend content={<ChartLegendContent />} />
        </AreaChart>
      </ChartContainer>
      <p className="sr-only">{summary}</p>
    </div>
  );
}
