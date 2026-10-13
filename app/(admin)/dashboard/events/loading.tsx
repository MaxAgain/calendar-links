import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function EventsLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true" aria-label="Loading events">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-64 max-w-full" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-full sm:w-80" />
        <Skeleton className="h-8 w-full sm:w-64" />
      </div>

      <Card className="gap-0 py-0">
        <div className="flex h-10 items-center gap-4 border-b px-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="ml-auto h-4 w-16" />
          <Skeleton className="hidden h-4 w-16 sm:block" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-3 py-3 last:border-0">
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="hidden h-4 w-28 md:block" />
            <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="size-8" />
          </div>
        ))}
      </Card>
      <span className="sr-only">Loading …</span>
    </div>
  );
}
