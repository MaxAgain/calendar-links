'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useOptimistic, useTransition } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ANALYTICS_RANGES, parseRange, type AnalyticsRange } from '@/lib/analytics';
import { cn } from '@/lib/utils';

/** Switches the analytics range via the `range` search param, keeping other params (e.g. `tab`). */
export function RangeToggle({ value }: { value: AnalyticsRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  // Shows the new selection immediately while the server renders the new numbers.
  const [selected, setSelected] = useOptimistic(value);

  function change(next: string) {
    // Clicking the active item reports an empty value: keep the current range.
    if (!next) return;
    const range = parseRange(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', range);
    startTransition(() => {
      setSelected(range);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      value={selected}
      onValueChange={change}
      aria-label="Time range"
      aria-busy={pending}
      className={cn('max-w-full transition-opacity', pending && 'opacity-70')}
    >
      {ANALYTICS_RANGES.map((range) => (
        <ToggleGroupItem
          key={range.value}
          value={range.value}
          className="text-muted-foreground data-[state=on]:font-semibold data-[state=on]:text-foreground"
        >
          {range.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
