import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDelta } from '@/lib/format';
import { cn } from '@/lib/utils';

type Direction = 'up' | 'down' | 'flat';

const TONE: Record<Direction, string> = {
  up: 'border-success/20 bg-success/10 text-success',
  down: 'border-destructive/20 bg-destructive/10 text-destructive',
  flat: 'text-muted-foreground',
};

const ICON = { up: TrendingUpIcon, down: TrendingDownIcon, flat: MinusIcon };

/**
 * Change against the previous period. `relative` shows a percentage change ("+12.0%", "New" when there was nothing before),
 * `points` shows the difference of two ratios in percentage points ("+2.1 pp"). Renders nothing without a previous value.
 */
export function DeltaBadge({
  current,
  previous,
  mode = 'relative',
  className,
}: {
  current: number;
  previous: number | null | undefined;
  mode?: 'relative' | 'points';
  className?: string;
}) {
  if (previous == null) return null;

  let label: string;
  let direction: Direction;
  if (mode === 'points') {
    const diff = (current - previous) * 100;
    const text = Math.abs(diff).toFixed(1);
    direction = text === '0.0' ? 'flat' : diff > 0 ? 'up' : 'down';
    label = direction === 'flat' ? '0.0 pp' : `${diff > 0 ? '+' : '−'}${text} pp`;
  } else {
    const delta = formatDelta(current, previous);
    label = delta.label;
    direction = delta.label === 'New' || delta.label === '0.0%' ? 'flat' : delta.value > 0 ? 'up' : 'down';
  }

  const Icon = ICON[direction];
  const spoken = direction === 'flat' ? 'no change' : direction === 'up' ? 'up' : 'down';
  return (
    <Badge variant="outline" className={cn('tabular-nums', TONE[direction], className)}>
      <Icon aria-hidden />
      {label}
      <span className="sr-only">{label === 'New' ? ', new compared with the previous period' : `, ${spoken} compared with the previous period`}</span>
    </Badge>
  );
}
