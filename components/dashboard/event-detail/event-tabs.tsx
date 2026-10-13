'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EVENT_TABS, type EventTab } from './tabs';

/**
 * Tab switcher that keeps the active tab in `?tab=` (other params, such as `range`, are kept).
 * The panels arrive as props, so server-rendered content like the analytics stays on the server.
 */
export function EventTabs({
  tab,
  overview,
  share,
  details,
}: {
  tab: EventTab;
  overview: ReactNode;
  share: ReactNode;
  details: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState<EventTab>(tab);
  const [seenTab, setSeenTab] = useState<EventTab>(tab);

  // Follow the URL when it changes from outside (browser back/forward, links with ?tab=).
  if (tab !== seenTab) {
    setSeenTab(tab);
    setValue(tab);
  }

  function change(next: string) {
    if (!EVENT_TABS.includes(next as EventTab)) return;
    setValue(next as EventTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={value} onValueChange={change} className="gap-6">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="share">Share</TabsTrigger>
        <TabsTrigger value="details">Details</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="flex flex-col gap-6">
        {overview}
      </TabsContent>
      <TabsContent value="share">{share}</TabsContent>
      <TabsContent value="details">{details}</TabsContent>
    </Tabs>
  );
}
