'use client';

// The recipient page body. Server-rendered with the device detected from the user agent, so the
// right calendar is highlighted even before JavaScript runs; all buttons are plain links.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { googleUrl, isPast, outlookUrl, yahooUrl, type CalendarEvent, type CalendarId } from '@/lib/calendar';
import { LOCALES, translator, type Lang } from '@/lib/i18n';
import { detectPlatform, isMobile, needsSafariHint, OTHER_CALENDARS, recommendCalendar, type Platform } from '@/lib/platform';
import { APP_VERSION } from '@/lib/site';
import { CalendarButtonIcon, CalendarIcon, CalendarPlusIcon, CheckIcon, ClockIcon, CopyIcon, InfoIcon, LinkIcon, PinIcon } from './icons';
import { createTracker, utmParams, viewerTimeZone, type Track } from './tracker';

const ICS_CALENDARS = new Set<CalendarId>(['apple', 'outlook', 'ics']);
const noopSubscribe = () => () => {};

interface Props {
  event: CalendarEvent;
  initialPlatform: Platform;
  lang: Lang;
  icsHref: string;
  /** Dashboard preview: fixed device, no tracking. */
  preview?: boolean;
}

const platformKey = (p: Platform) => [p.os, p.browser, p.device, p.inApp].join('|');
function platformFromKey(key: string): Platform {
  const [os, browser, device, inApp] = key.split('|');
  return { os: os as Platform['os'], browser, device: device as Platform['device'], inApp };
}

/** Text with URLs turned into safe links. */
function linkify(text: string): ReactNode[] {
  return String(text)
    .split(/(https?:\/\/[^\s<>"]+)/g)
    .map((part, i) =>
      i % 2 === 1 ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
      ) : (
        part
      ),
    );
}

function formatWhen(event: CalendarEvent, locale: string, timeZone: string, t: ReturnType<typeof translator>) {
  if (event.allDay) {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    const toDate = (s: string) => new Date(`${s}T12:00:00Z`);
    const range = event.start === event.end ? fmt.format(toDate(event.start)) : `${fmt.format(toDate(event.start))} – ${fmt.format(toDate(event.end))}`;
    return { primary: range, secondary: t('allDay') };
  }
  const start = new Date(event.startUtc);
  const end = new Date(event.endUtc);
  const dateFmt = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone });
  const shortDateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone });
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone });
  return dateFmt.format(start) === dateFmt.format(end)
    ? { primary: dateFmt.format(start), secondary: `${timeFmt.format(start)} – ${timeFmt.format(end)}${t('timeSuffix')}` }
    : { primary: `${shortDateFmt.format(start)}, ${timeFmt.format(start)}`, secondary: `– ${shortDateFmt.format(end)}, ${timeFmt.format(end)}${t('timeSuffix')}` };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.cssText = 'position:fixed;opacity:0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

export function EventLanding({ event, initialPlatform, lang, icsHref, preview = false }: Props) {
  const t = translator(lang);
  const locale = LOCALES[lang];

  // Server snapshot = what the server rendered; client snapshot refines it (e.g. iPads in desktop mode).
  const liveKey = useSyncExternalStore(
    noopSubscribe,
    () => platformKey(detectPlatform(navigator.userAgent, { maxTouchPoints: navigator.maxTouchPoints || 0 })),
    () => platformKey(initialPlatform),
  );
  const platform = preview ? initialPlatform : platformFromKey(liveKey);
  const timeZone = useSyncExternalStore(noopSubscribe, () => viewerTimeZone() || event.timezone, () => event.timezone);

  const [toast, setToast] = useState('');
  const [copied, setCopied] = useState(false);
  const track = useRef<Track>(() => {});

  useEffect(() => {
    if (preview) return;
    const p = detectPlatform(navigator.userAgent, { maxTouchPoints: navigator.maxTouchPoints || 0 });
    track.current = createTracker('/api/track', {
      event_id: event.id,
      os: p.os,
      browser: p.browser,
      device: p.device,
      in_app: p.inApp,
      language: (navigator.language || '').slice(0, 10),
      timezone: viewerTimeZone(),
      app_version: APP_VERSION,
      ...utmParams(window.location.search),
    });
    track.current('view');
  }, [event.id, preview]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const recommended = recommendCalendar(platform);
  const mobile = isMobile(platform);
  const links = useMemo<Record<CalendarId, string>>(
    () => ({
      apple: icsHref,
      outlook: icsHref,
      ics: icsHref,
      google: googleUrl(event),
      outlookcom: outlookUrl(event, { host: 'live', mobile }),
      office365: outlookUrl(event, { host: 'office', mobile }),
      yahoo: yahooUrl(event),
    }),
    [event, icsHref, mobile],
  );

  const when = formatWhen(event, locale, timeZone, t);
  const eventTime = formatWhen(event, locale, event.timezone, t);
  const showsLocalTime = !event.allDay && (when.primary !== eventTime.primary || when.secondary !== eventTime.secondary);
  const past = isPast(event);

  const calendarButton = (calendar: CalendarId, primary: boolean) => {
    const isIcs = ICS_CALENDARS.has(calendar);
    return (
      <a
        key={calendar}
        className={primary ? 'btn btn--primary' : 'btn'}
        href={links[calendar]}
        // Web calendars open in a new tab on desktop; .ics stays in-tab so iOS/macOS Safari can show "Add to Calendar".
        target={!isIcs && !mobile ? '_blank' : undefined}
        rel={!isIcs ? 'noopener' : undefined}
        data-calendar={calendar}
        onClick={() => {
          track.current('add', { calendar, was_recommended: calendar === recommended });
          if (isIcs && !mobile && platform.os !== 'macos') setTimeout(() => setToast(t('icsDownloaded')), 800);
        }}
      >
        <CalendarButtonIcon calendar={calendar} />
        <span className="btn__label">{primary ? t('addTo', { calendar: t(calendar) }) : t(calendar)}</span>
      </a>
    );
  };

  return (
    <>
      <article className="card">
        {preview && <p className="preview-badge">{t('preview')}</p>}
        <p className="eyebrow"><CalendarPlusIcon />{t('pageTitle')}</p>
        <h1>{event.title}</h1>
        <ul className="meta">
          <li><CalendarIcon /><span>{when.primary}</span></li>
          <li>
            <ClockIcon />
            <span>
              {when.secondary}
              {showsLocalTime && <small>{t('localTime', { tz: timeZone })}</small>}
            </span>
          </li>
          {event.location && <li><PinIcon /><span>{linkify(event.location)}</span></li>}
          {event.url && event.url !== event.location && (
            <li><LinkIcon /><a href={event.url} target="_blank" rel="noopener noreferrer">{t('onlineLink')}</a></li>
          )}
        </ul>
        {event.description && <p className="description">{linkify(event.description)}</p>}

        {past ? (
          <p className="notice notice--muted" role="status"><InfoIcon /><span>{t('past')}</span></p>
        ) : (
          <>
            {needsSafariHint(platform) && (
              <div className="notice notice--info">
                <InfoIcon />
                <div>
                  {t('safariHint')}
                  <br />
                  <button className="btn" type="button" onClick={async () => setCopied(await copyText(window.location.href))}>
                    {copied ? <><CheckIcon />{t('copied')}</> : <><CopyIcon />{t('copyLink')}</>}
                  </button>
                </div>
              </div>
            )}
            <p className="label">{t('recommended')}</p>
            {calendarButton(recommended, true)}
            <div className="section">
              <p className="label">{t('otherCalendars')}</p>
              <div className="btn-grid">{OTHER_CALENDARS[platform.os].map((c) => calendarButton(c, false))}</div>
            </div>
          </>
        )}
      </article>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
