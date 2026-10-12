'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { createTracker, utmParams } from '@/components/landing/tracker';
import { detectPlatform } from '@/lib/platform';
import { APP_VERSION } from '@/lib/site';

/** Counts clicks on broken or mistyped links, so a bad link in a sent email shows up in the stats. */
export function TrackNotFound() {
  const pathname = usePathname();
  useEffect(() => {
    const p = detectPlatform(navigator.userAgent, { maxTouchPoints: navigator.maxTouchPoints || 0 });
    const id = pathname.split('/')[2] || new URLSearchParams(window.location.search).get('id') || '';
    createTracker('/api/track', {
      event_id: id.toLowerCase().slice(0, 64),
      os: p.os,
      browser: p.browser,
      device: p.device,
      app_version: APP_VERSION,
      ...utmParams(window.location.search),
    })('not_found');
  }, [pathname]);
  return null;
}
