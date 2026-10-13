import type { ReactNode } from 'react';
import { SampleBadge } from '@/components/dashboard/sample-badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ANALYTICS_SAMPLE } from '@/lib/analytics';
import { cn } from '@/lib/utils';

/** Four KPI cards per row on wide screens, two on tablets, one on phones. */
export function KpiGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>;
}

export function KpiCard({
  title,
  value,
  delta,
  note,
  sample = ANALYTICS_SAMPLE,
}: {
  title: string;
  /** Already formatted, e.g. "1,234" or "23.4%". */
  value: string;
  /** Usually a <DeltaBadge>. */
  delta?: ReactNode;
  /** Small muted text next to the delta, e.g. "vs previous 30 days". */
  note?: ReactNode;
  /** Set to false for cards that show real data. */
  sample?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex min-h-5 items-center justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {sample ? <SampleBadge /> : null}
        </div>
        <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      </CardHeader>
      {delta || note ? (
        <CardContent className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {delta}
          {note ? <span className="min-w-0">{note}</span> : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
