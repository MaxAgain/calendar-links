import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { EventLanding } from '@/components/landing/EventLanding';
import { ID_PATTERN } from '@/lib/calendar';
import { getPublicEvent } from '@/lib/events';
import { parseAcceptLanguage, pickLang } from '@/lib/i18n';
import { detectPlatform } from '@/lib/platform';
import { BRAND_NAME } from '@/lib/site';

async function loadEvent(id: string) {
  if (!ID_PATTERN.test(id)) return null;
  const event = await getPublicEvent(id);
  return event && !event.archived ? event : null;
}

export async function generateMetadata({ params }: PageProps<'/e/[id]'>): Promise<Metadata> {
  const event = await loadEvent((await params).id);
  return { title: event ? `${event.title} · ${BRAND_NAME}` : BRAND_NAME };
}

export default async function EventPage({ params, searchParams }: PageProps<'/e/[id]'>) {
  const { id } = await params;
  if (id !== id.toLowerCase()) {
    const query = new URLSearchParams(Object.entries(await searchParams).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])));
    redirect(`/e/${id.toLowerCase()}${query.size ? `?${query}` : ''}`);
  }

  const event = await loadEvent(id);
  if (!event) notFound();

  const h = await headers();
  const lang = pickLang(parseAcceptLanguage(h.get('accept-language')));
  return (
    <div lang={lang}>
      <EventLanding
        event={event}
        initialPlatform={detectPlatform(h.get('user-agent') ?? '')}
        lang={lang}
        icsHref={`/e/${event.id}/calendar.ics`}
      />
    </div>
  );
}
