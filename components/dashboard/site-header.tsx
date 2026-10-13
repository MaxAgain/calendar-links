'use client';

import { usePathname } from 'next/navigation';
import { Fragment } from 'react';
import { GuardedLink } from '@/components/dashboard/navigation-guard';
import { ThemeToggle } from '@/components/dashboard/theme/theme-toggle';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

interface Crumb {
  label: string;
  href: string;
  mono?: boolean;
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Builds the trail from the URL: Overview > Events > <event id> > Edit. */
function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean).slice(1); // drop "dashboard"
  const crumbs: Crumb[] = [{ label: 'Overview', href: '/dashboard' }];
  const [section, second, third] = segments;

  if (section === 'integrations') {
    crumbs.push({ label: 'Integrations', href: '/dashboard/integrations' });
  } else if (section === 'events') {
    crumbs.push({ label: 'Events', href: '/dashboard/events' });
    if (second === 'new') {
      crumbs.push({ label: 'New event', href: '/dashboard/events/new' });
    } else if (second) {
      crumbs.push({ label: safeDecode(second), href: `/dashboard/events/${second}`, mono: true });
      if (third === 'edit') crumbs.push({ label: 'Edit', href: `/dashboard/events/${second}/edit` });
    }
  }
  return crumbs;
}

export function SiteHeader() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);
  const last = crumbs.length - 1;

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:rounded-t-xl">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-vertical:h-4 data-vertical:self-center" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((crumb, i) => {
            // On small screens only the last two items are shown.
            const hiddenOnMobile = i < last - 1;
            return (
              <Fragment key={crumb.href}>
                {i > 0 && <BreadcrumbSeparator className={cn(i < last && 'hidden md:block')} />}
                <BreadcrumbItem className={cn('min-w-0', hiddenOnMobile && 'hidden md:inline-flex')}>
                  {i === last ? (
                    <BreadcrumbPage className={cn('truncate', crumb.mono && 'font-mono text-[0.8125rem]')}>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <GuardedLink href={crumb.href} className={cn('truncate', crumb.mono && 'max-w-40 font-mono text-[0.8125rem] md:max-w-none')}>
                        {crumb.label}
                      </GuardedLink>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <ThemeToggle />
    </header>
  );
}
