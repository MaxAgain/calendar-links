// UI strings for the recipient page. Event texts are shown as written in the dashboard.
// German always uses the formal "Sie".

export type Lang = 'de' | 'en';

export const STRINGS = {
  de: {
    pageTitle: 'Zum Kalender hinzufügen',
    recommended: 'Empfohlen für dieses Gerät',
    otherCalendars: 'Andere Kalender',
    apple: 'Apple Kalender',
    google: 'Google Kalender',
    outlook: 'Outlook (Desktop)',
    outlookcom: 'Outlook.com',
    office365: 'Microsoft 365',
    yahoo: 'Yahoo Kalender',
    ics: 'Andere (.ics-Datei)',
    addTo: 'Zu {calendar} hinzufügen',
    allDay: 'Ganztägig',
    timeSuffix: ' Uhr',
    localTime: 'Uhrzeit in Ihrer Zeitzone ({tz})',
    eventTime: 'Uhrzeit: {tz}',
    onlineLink: 'Link zur Veranstaltung',
    past: 'Dieser Termin hat bereits stattgefunden.',
    notFoundTitle: 'Termin nicht gefunden',
    notFound: 'Dieser Link ist ungültig oder der Termin ist nicht mehr verfügbar.',
    safariHint: 'Um den Termin zu Apple Kalender hinzuzufügen, öffnen Sie diese Seite bitte in Safari: Kopieren Sie den Link und fügen Sie ihn in Safari ein.',
    copyLink: 'Link kopieren',
    copied: 'Kopiert!',
    icsDownloaded: 'Die Kalenderdatei wurde heruntergeladen. Bitte öffnen Sie die Datei, um den Termin hinzuzufügen.',
    toWebsite: 'Zur Website',
    preview: 'Vorschau – Klicks werden nicht gezählt',
  },
  en: {
    pageTitle: 'Add to calendar',
    recommended: 'Recommended for this device',
    otherCalendars: 'Other calendars',
    apple: 'Apple Calendar',
    google: 'Google Calendar',
    outlook: 'Outlook (desktop)',
    outlookcom: 'Outlook.com',
    office365: 'Microsoft 365',
    yahoo: 'Yahoo Calendar',
    ics: 'Other (.ics file)',
    addTo: 'Add to {calendar}',
    allDay: 'All day',
    timeSuffix: '',
    localTime: 'Times shown in your time zone ({tz})',
    eventTime: 'Time zone: {tz}',
    onlineLink: 'Event link',
    past: 'This event has already taken place.',
    notFoundTitle: 'Event not found',
    notFound: 'This link is invalid or the event is no longer available.',
    safariHint: 'To add this to Apple Calendar, please open this page in Safari: copy the link and paste it into Safari.',
    copyLink: 'Copy link',
    copied: 'Copied!',
    icsDownloaded: 'The calendar file has been downloaded. Open it to add the event.',
    toWebsite: 'Go to website',
    preview: 'Preview – clicks are not counted',
  },
} as const;

export type StringKey = keyof (typeof STRINGS)['de'];

/** German if the visitor prefers German, English for everything else. */
export function pickLang(languages: readonly string[] = []): Lang {
  for (const lang of languages) {
    const l = String(lang).toLowerCase();
    if (l.startsWith('de')) return 'de';
    if (l.startsWith('en')) return 'en';
  }
  return 'en';
}

/** Parses an Accept-Language header into languages ordered by preference. */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { tag: tag.trim(), q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .filter((x) => x.tag && x.tag !== '*')
    .sort((a, b) => b.q - a.q)
    .map((x) => x.tag);
}

export function translator(lang: Lang) {
  const table = STRINGS[lang] ?? STRINGS.en;
  return (key: StringKey, vars: Record<string, string> = {}) =>
    (table[key] ?? STRINGS.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
}

export const LOCALES: Record<Lang, string> = { de: 'de-DE', en: 'en-GB' };
