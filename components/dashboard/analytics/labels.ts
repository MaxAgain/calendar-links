import { ANALYTICS_RANGES, type AnalyticsRange } from '@/lib/analytics';

/** "7 days", "All time" */
export function rangeLabel(range: AnalyticsRange): string {
  return ANALYTICS_RANGES.find((r) => r.value === range)?.label ?? range;
}

/** "vs previous 7 days"; 'all' has no previous period. */
export function comparisonLabel(range: AnalyticsRange): string {
  return range === 'all' ? 'Since the first visit' : `vs previous ${rangeLabel(range).toLowerCase()}`;
}
