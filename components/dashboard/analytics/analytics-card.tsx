import type { ReactNode } from 'react';
import { SampleBadge } from '@/components/dashboard/sample-badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ANALYTICS_SAMPLE } from '@/lib/analytics';
import { cn } from '@/lib/utils';

/** A titled card for one analytics block. Shows the "Sample data" badge in its header while analytics are mocked. */
export function AnalyticsCard({
  title,
  description,
  sample = ANALYTICS_SAMPLE,
  action,
  footer,
  className,
  contentClassName,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Set to false for cards that show real data. */
  sample?: boolean;
  /** Extra header content, shown before the sample badge. */
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {sample || action ? (
          <CardAction className="flex items-center gap-2">
            {action}
            {sample ? <SampleBadge /> : null}
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className={cn('flex-1', contentClassName)}>{children}</CardContent>
      {footer ? <div className="px-(--card-spacing) text-xs text-muted-foreground">{footer}</div> : null}
    </Card>
  );
}
