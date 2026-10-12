// Recipient landing page: /e/?id=<event-id>
import { CONFIG } from '../config.js';
import { ID_PATTERN, buildIcs, googleUrl, outlookUrl, yahooUrl, isPast } from './calendar.js';
import { detectPlatform, recommendCalendar, needsSafariHint, isMobile } from './platform.js';
import { pickLang, translator, LOCALES } from './i18n.js';
import { createTracker, utmParams } from './track.js';
import { ICONS, CALENDAR_ICONS } from './icons.js';
import { h, copyText } from './dom.js';

const ICS_CALENDARS = new Set(['apple', 'outlook', 'ics']);

// Secondary buttons per OS (the recommended one is shown separately above them).
const OTHER_CALENDARS = {
  ios: ['google', 'office365', 'outlookcom', 'yahoo'],
  macos: ['google', 'office365', 'outlookcom', 'yahoo', 'ics'],
  android: ['office365', 'outlookcom', 'yahoo', 'ics'],
  windows: ['google', 'office365', 'outlookcom', 'yahoo'],
  other: ['apple', 'office365', 'outlookcom', 'yahoo', 'ics'],
};

const params = new URLSearchParams(location.search);
const isPreview = params.has('preview');
const lang = pickLang(navigator.languages?.length ? navigator.languages : [navigator.language]);
const t = translator(lang);
const locale = LOCALES[lang];
const app = document.getElementById('app');
const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

document.documentElement.lang = lang;
document.title = `${t('pageTitle')} · ${CONFIG.brandName}`;

// --------------------------------------------------------------------------- DOM helpers

const icon = (name) => h('span', { html: ICONS[name] || CALENDAR_ICONS[name], style: 'display:contents' });

/** Text with URLs turned into safe links. */
function linkify(text) {
  const parts = String(text).split(/(https?:\/\/[^\s<>"]+)/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? h('a', { href: part, target: '_blank', rel: 'noopener noreferrer' }, part)
      : part,
  );
}

function showToast(message) {
  document.querySelector('.toast')?.remove();
  const toast = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(toast);
  setTimeout(() => toast.remove(), 6000);
}

// --------------------------------------------------------------------------- formatting

function formatWhen(event) {
  if (event.allDay) {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    const toDate = (s) => new Date(`${s}T12:00:00Z`);
    const range = event.start === event.end
      ? fmt.format(toDate(event.start))
      : `${fmt.format(toDate(event.start))} – ${fmt.format(toDate(event.end))}`;
    return { primary: range, secondary: t('allDay'), tzNote: '' };
  }

  const start = new Date(event.startUtc);
  const end = new Date(event.endUtc);
  const dateFmt = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const shortDateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  const sameDay = dateFmt.format(start) === dateFmt.format(end);

  const result = sameDay
    ? { primary: dateFmt.format(start), secondary: `${timeFmt.format(start)} – ${timeFmt.format(end)}${t('timeSuffix')}` }
    : { primary: `${shortDateFmt.format(start)}, ${timeFmt.format(start)}`, secondary: `– ${shortDateFmt.format(end)}, ${timeFmt.format(end)}${t('timeSuffix')}` };

  // Only mention the time zone when the viewer's local time differs from the organizer's.
  const eventTimeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: event.timezone });
  result.tzNote = eventTimeFmt.format(start) !== timeFmt.format(start) ? t('localTime', { tz: viewerTz }) : '';
  return result;
}

// --------------------------------------------------------------------------- rendering

function calendarLinks(event, platform, icsHref) {
  const mobile = isMobile(platform);
  return {
    apple: icsHref,
    outlook: icsHref,
    ics: icsHref,
    google: googleUrl(event),
    outlookcom: outlookUrl(event, { host: 'live', mobile }),
    office365: outlookUrl(event, { host: 'office', mobile }),
    yahoo: yahooUrl(event),
  };
}

function renderEvent(event, platform, { icsHref, track }) {
  const recommended = recommendCalendar(platform);
  const links = calendarLinks(event, platform, icsHref);
  const when = formatWhen(event);
  const past = isPast(event);
  const desktop = !isMobile(platform);

  const calendarButton = (calendar, primary) => {
    const isIcs = ICS_CALENDARS.has(calendar);
    return h(
      'a',
      {
        class: primary ? 'btn btn--primary' : 'btn',
        href: links[calendar],
        // Web calendars open in a new tab on desktop so the page stays available; .ics stays in-tab
        // so iOS/macOS Safari can show the "Add to Calendar" sheet.
        target: !isIcs && desktop ? '_blank' : undefined,
        rel: !isIcs ? 'noopener' : undefined,
        'data-calendar': calendar,
        onclick: () => {
          track('add', { calendar, was_recommended: calendar === recommended });
          if (isIcs && desktop && platform.os !== 'macos') setTimeout(() => showToast(t('icsDownloaded')), 800);
        },
      },
      icon(calendar),
      h('span', { class: 'btn__label' }, primary ? t('addTo', { calendar: t(calendar) }) : t(calendar)),
    );
  };

  const meta = h('ul', { class: 'meta' },
    h('li', {}, icon('calendar'), h('span', {}, when.primary)),
    h('li', {}, icon('clock'), h('span', {}, when.secondary, when.tzNote ? h('small', {}, when.tzNote) : null)),
    event.location ? h('li', {}, icon('pin'), h('span', {}, linkify(event.location))) : null,
    event.url && event.url !== event.location
      ? h('li', {}, icon('link'), h('a', { href: event.url, target: '_blank', rel: 'noopener noreferrer' }, t('onlineLink')))
      : null,
  );

  const children = [
    isPreview ? h('p', { class: 'preview-badge' }, t('preview')) : null,
    h('p', { class: 'eyebrow' }, icon('calendarPlus'), t('pageTitle')),
    h('h1', {}, event.title),
    meta,
    event.description ? h('p', { class: 'description' }, linkify(event.description)) : null,
  ];

  if (past) {
    children.push(h('p', { class: 'notice notice--muted', role: 'status' }, icon('info'), h('span', {}, t('past'))));
  } else {
    if (needsSafariHint(platform)) {
      const copyBtn = h('button', { class: 'btn', type: 'button' }, icon('copy'), t('copyLink'));
      copyBtn.addEventListener('click', async () => {
        if (await copyText(location.href)) {
          copyBtn.replaceChildren(icon('check'), t('copied'));
        }
      });
      children.push(h('div', { class: 'notice notice--info' }, icon('info'), h('div', {}, t('safariHint'), h('br'), copyBtn)));
    }
    children.push(
      h('p', { class: 'label' }, t('recommended')),
      calendarButton(recommended, true),
      h('div', { class: 'section' },
        h('p', { class: 'label' }, t('otherCalendars')),
        h('div', { class: 'btn-grid' }, (OTHER_CALENDARS[platform.os] || OTHER_CALENDARS.other).map((c) => calendarButton(c, false))),
      ),
    );
  }

  app.replaceChildren(h('article', { class: 'card' }, children));
}

function renderMessage(titleKey, textKey, { retry } = {}) {
  app.replaceChildren(
    h('div', { class: 'card' },
      h('h1', {}, t(titleKey)),
      h('p', {}, t(textKey)),
      retry ? h('button', { class: 'btn btn--primary', type: 'button', onclick: retry }, t('retry')) : null,
      h('p', { class: 'section' }, h('a', { href: CONFIG.brandUrl }, `${t('toWebsite')} →`)),
    ),
  );
}

// --------------------------------------------------------------------------- data loading

function platformFromOverride(os) {
  const presets = {
    ios: { os: 'ios', browser: 'safari', device: 'mobile', inApp: '' },
    'ios-inapp': { os: 'ios', browser: 'other', device: 'mobile', inApp: 'gmail' },
    android: { os: 'android', browser: 'chrome', device: 'mobile', inApp: '' },
    windows: { os: 'windows', browser: 'edge', device: 'desktop', inApp: '' },
    macos: { os: 'macos', browser: 'safari', device: 'desktop', inApp: '' },
  };
  return presets[os] || null;
}

async function loadEvent(id) {
  const res = await fetch(new URL(`../events/${id}.json`, location.href), { cache: 'no-cache' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function start() {
  const platform = detectPlatform(navigator.userAgent, { maxTouchPoints: navigator.maxTouchPoints || 0 });
  const rawId = (params.get('id') || '').trim().toLowerCase();
  const track = createTracker(isPreview ? '' : CONFIG.trackingUrl, {
    event_id: rawId.slice(0, 64),
    os: platform.os,
    browser: platform.browser,
    device: platform.device,
    in_app: platform.inApp,
    language: (navigator.language || '').slice(0, 10),
    timezone: viewerTz,
    app_version: CONFIG.appVersion,
    ...utmParams(params),
  });

  if (!ID_PATTERN.test(rawId)) {
    track('not_found');
    renderMessage('notFoundTitle', 'notFound');
    return;
  }

  try {
    const event = await loadEvent(rawId);
    if (!event || event.archived) {
      track('not_found');
      renderMessage('notFoundTitle', 'notFound');
      return;
    }
    const icsHref = new URL(`../events/${rawId}.ics`, location.href).href;
    renderEvent(event, platform, { icsHref, track });
    track('view');
  } catch (err) {
    console.error(err);
    renderMessage('loadErrorTitle', 'loadError', { retry: () => { app.replaceChildren(h('div', { class: 'card skeleton' }, t('loading'))); start(); } });
  }
}

// Dashboard preview: the editor posts the draft event into this page (same origin only).
function startPreview() {
  let blobUrl = '';
  window.addEventListener('message', (msg) => {
    if (msg.origin !== location.origin || msg.data?.type !== 'atc-preview') return;
    const { event, platform: os } = msg.data;
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = URL.createObjectURL(new Blob([buildIcs(event)], { type: 'text/calendar' }));
    const platform = platformFromOverride(os) || detectPlatform(navigator.userAgent, { maxTouchPoints: navigator.maxTouchPoints || 0 });
    renderEvent(event, platform, { icsHref: blobUrl, track: () => {} });
  });
  window.parent?.postMessage({ type: 'atc-preview-ready' }, location.origin);
}

if (isPreview) startPreview();
else start();
