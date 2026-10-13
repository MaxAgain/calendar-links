'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Marks figures that are generated for the design, not measured. Remove once analytics are connected.
export function SampleBadge({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" tabIndex={0} className={cn('cursor-help text-muted-foreground', className)}>
          Sample data
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Analytics are not connected yet. These figures are generated for the design.</TooltipContent>
    </Tooltip>
  );
}
