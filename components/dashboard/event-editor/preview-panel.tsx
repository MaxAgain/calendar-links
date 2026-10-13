'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { CalendarEvent } from '@/lib/calendar';
import { PREVIEW_PLATFORMS } from '@/lib/platform';

const noopSubscribe = () => () => {};

const DEVICE_LABELS: Record<keyof typeof PREVIEW_PLATFORMS, string> = {
  ios: 'iPhone (Safari)',
  'ios-inapp': 'iPhone (in-app)',
  android: 'Android',
  windows: 'Windows',
  macos: 'Mac',
};

type Lang = 'de' | 'en';

/**
 * The real recipient page in an iframe, fed through postMessage: the page announces `atc-preview-ready`,
 * then receives the draft event, device and language on every (debounced) change.
 */
export function PreviewPanel({
  draft,
  title = 'Live preview',
  description = 'Buttons in the preview work, so you can test the calendar entries. Preview clicks are not tracked.',
}: {
  draft: CalendarEvent | null;
  title?: string;
  description?: string;
}) {
  const [platform, setPlatform] = useState('ios');
  const [lang, setLang] = useState<Lang>('de');
  const [ready, setReady] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  // Load the iframe only after hydration, so its `atc-preview-ready` message cannot arrive before the listener below exists.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    const onMessage = (msg: MessageEvent) => {
      if (msg.origin === window.location.origin && msg.data?.type === 'atc-preview-ready') setReady(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!ready || !draft) return;
    const timer = setTimeout(() => {
      frame.current?.contentWindow?.postMessage({ type: 'atc-preview', event: draft, platform, lang }, window.location.origin);
    }, 150);
    return () => clearTimeout(timer);
  }, [draft, platform, lang, ready]);

  return (
    <Card className="lg:sticky lg:top-20">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger size="sm" aria-label="Preview device" className="min-w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              {Object.keys(PREVIEW_PLATFORMS).map((key) => (
                <SelectItem key={key} value={key}>
                  {DEVICE_LABELS[key] ?? key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={lang}
            onValueChange={(value) => value && setLang(value as Lang)}
            aria-label="Preview language"
          >
            <ToggleGroupItem value="de" aria-label="Deutsch">DE</ToggleGroupItem>
            <ToggleGroupItem value="en" aria-label="English">EN</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="relative mx-auto h-[640px] w-full max-w-[360px] overflow-hidden rounded-[2rem] border-8 border-sk-gray-800 bg-background ring-1 ring-border">
          <iframe ref={frame} src={hydrated ? '/preview' : undefined} title="Recipient page preview" className="size-full bg-background" />
          {!draft && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 p-6 text-center text-sm text-muted-foreground">
              Fix the highlighted fields to update the preview.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
