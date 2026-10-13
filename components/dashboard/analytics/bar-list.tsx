import { formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface BarItem {
  key: string;
  label: string;
  value: number;
  /** Part of `value` to highlight with a solid bar over the lighter one (e.g. adds from the recommended button). */
  highlight?: number;
}

/**
 * Sorted horizontal bars in one colour. Every row shows the number and its share of the total, so it
 * reads without hovering. Zero rows are left out. Bars are decorative; the list itself carries the data.
 */
export function BarList({
  items,
  label,
  emptyText = 'No data in this period.',
  unit,
  className,
}: {
  items: BarItem[];
  /** Accessible name of the list. */
  label: string;
  emptyText?: string;
  /** Read out after each value by screen readers, e.g. "adds". */
  unit?: string;
  className?: string;
}) {
  const rows = items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;

  const max = rows[0].value;
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const width = (value: number) => `${Math.max(2, (value / max) * 100)}%`;

  return (
    <ul aria-label={label} className={cn('flex flex-col gap-3', className)}>
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{row.label}</span>
            <span className="shrink-0 tabular-nums">
              <span className="font-mono font-medium">{formatNumber(row.value)}</span>
              {unit ? <span className="sr-only"> {unit}</span> : null}
              <span className="ml-2 inline-block w-10 text-right text-xs text-muted-foreground">{formatPercent(row.value / total, 0)}</span>
            </span>
          </div>
          <div aria-hidden className="relative h-2 overflow-hidden rounded-full bg-muted">
            <div className={cn('absolute inset-y-0 left-0 rounded-full bg-chart-1', row.highlight != null && 'bg-chart-1/35')} style={{ width: width(row.value) }} />
            {row.highlight ? <div className="absolute inset-y-0 left-0 rounded-full bg-chart-1" style={{ width: width(row.highlight) }} /> : null}
          </div>
          {row.highlight != null ? <span className="sr-only">{formatNumber(row.highlight)} of them through the recommended button</span> : null}
        </li>
      ))}
    </ul>
  );
}
