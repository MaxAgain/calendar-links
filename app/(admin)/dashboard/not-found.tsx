import { CompassIcon } from 'lucide-react';
import { GuardedLink } from '@/components/dashboard/navigation-guard';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

export default function DashboardNotFound() {
  return (
    <Empty className="min-h-[60svh] border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CompassIcon />
        </EmptyMedia>
        <EmptyTitle>Page not found</EmptyTitle>
        <EmptyDescription>The page or event you are looking for does not exist, or it has been moved.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Button asChild>
          <GuardedLink href="/dashboard/events">Go to events</GuardedLink>
        </Button>
        <Button variant="outline" asChild>
          <GuardedLink href="/dashboard">Back to overview</GuardedLink>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
