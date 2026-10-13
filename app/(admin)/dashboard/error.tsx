'use client';

import { TriangleAlertIcon } from 'lucide-react';
import { useEffect } from 'react';
import { GuardedLink } from '@/components/dashboard/navigation-guard';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Empty className="min-h-[60svh] border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>Something went wrong</EmptyTitle>
        <EmptyDescription>
          This page could not be loaded. Try again, or go back to the overview.
          {error.digest ? (
            <span className="mt-2 block font-mono text-xs text-muted-foreground">Error ID: {error.digest}</span>
          ) : null}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Button onClick={() => retry()}>Try again</Button>
        <Button variant="outline" asChild>
          <GuardedLink href="/dashboard">Back to overview</GuardedLink>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
