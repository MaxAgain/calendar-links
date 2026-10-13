// The single switch point for dashboard analytics: all UI reads from here.
// To go live, export the two functions from './db' (Postgres queries over `clicks`) instead of './mock'
// and set ANALYTICS_SAMPLE to false.
import type { AnalyticsRange } from './types';

export { getEventAnalytics, getOverviewAnalytics } from './mock';
export type * from './types';

/** True while the numbers are generated sample data, so the UI can label them as such. */
export const ANALYTICS_SAMPLE = true;

export const ANALYTICS_RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
];

const DEFAULT_RANGE: AnalyticsRange = '30d';

/** Reads a range from a URL search param (string or repeated string[]); anything invalid falls back to 30 days. */
export function parseRange(value: unknown): AnalyticsRange {
  const candidate = Array.isArray(value) ? value[0] : value;
  return ANALYTICS_RANGES.find((range) => range.value === candidate)?.value ?? DEFAULT_RANGE;
}
