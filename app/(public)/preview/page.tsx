'use client';

// Rendered inside the dashboard editor (iframe). Receives the draft event via postMessage from the
// same origin, so the preview is the real recipient page — same component, same CSS.
import { useEffect, useState } from 'react';
import { EventLanding } from '@/components/landing/EventLanding';
import { buildIcs, type CalendarEvent } from '@/lib/calendar';
import type { Lang } from '@/lib/i18n';
import { PREVIEW_PLATFORMS } from '@/lib/platform';

interface PreviewMessage {
  type: 'atc-preview';
  event: CalendarEvent;
  platform: keyof typeof PREVIEW_PLATFORMS;
  lang: Lang;
}

export default function PreviewPage() {
  const [message, setMessage] = useState<PreviewMessage | null>(null);
  const [icsHref, setIcsHref] = useState('');

  useEffect(() => {
    const onMessage = (msg: MessageEvent) => {
      if (msg.origin !== window.location.origin || msg.data?.type !== 'atc-preview') return;
      // Preview .ics as a local file so "Apple" / ".ics" buttons can be tested before publishing.
      const next = msg.data as PreviewMessage;
      setMessage(next);
      setIcsHref(URL.createObjectURL(new Blob([buildIcs(next.event)], { type: 'text/calendar' })));
    };
    window.addEventListener('message', onMessage);
    window.parent?.postMessage({ type: 'atc-preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Releases each blob URL once it is replaced (and on unmount).
  useEffect(() => () => URL.revokeObjectURL(icsHref), [icsHref]);

  if (!message || !icsHref) return null;
  return (
    <div lang={message.lang}>
      <EventLanding
        event={message.event}
        initialPlatform={PREVIEW_PLATFORMS[message.platform] ?? PREVIEW_PLATFORMS.ios}
        lang={message.lang}
        icsHref={icsHref}
        preview
      />
    </div>
  );
}
