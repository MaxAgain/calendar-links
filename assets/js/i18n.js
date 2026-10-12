// UI strings for the recipient landing page. Event texts are shown as written in the dashboard.
// German always uses the formal "Sie".

export const STRINGS = {
  de: {
    pageTitle: 'Zum Kalender hinzufügen',
    loading: 'Termin wird geladen …',
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
    onlineLink: 'Link zur Veranstaltung',
    past: 'Dieser Termin hat bereits stattgefunden.',
    notFoundTitle: 'Termin nicht gefunden',
    notFound: 'Dieser Link ist ungültig oder der Termin ist nicht mehr verfügbar.',
    loadErrorTitle: 'Termin konnte nicht geladen werden',
    loadError: 'Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.',
    retry: 'Erneut versuchen',
    safariHint: 'Um den Termin zu Apple Kalender hinzuzufügen, öffnen Sie diese Seite bitte in Safari: Kopieren Sie den Link und fügen Sie ihn in Safari ein.',
    copyLink: 'Link kopieren',
    copied: 'Kopiert!',
    icsDownloaded: 'Die Kalenderdatei wurde heruntergeladen. Bitte öffnen Sie die Datei, um den Termin hinzuzufügen.',
    toWebsite: 'Zur Website',
    preview: 'Vorschau – Klicks werden nicht gezählt',
  },
  en: {
    pageTitle: 'Add to calendar',
    loading: 'Loading event …',
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
    onlineLink: 'Event link',
    past: 'This event has already taken place.',
    notFoundTitle: 'Event not found',
    notFound: 'This link is invalid or the event is no longer available.',
    loadErrorTitle: 'Could not load the event',
    loadError: 'Please check your internet connection and try again.',
    retry: 'Try again',
    safariHint: 'To add this to Apple Calendar, please open this page in Safari: copy the link and paste it into Safari.',
    copyLink: 'Copy link',
    copied: 'Copied!',
    icsDownloaded: 'The calendar file has been downloaded. Open it to add the event.',
    toWebsite: 'Go to website',
    preview: 'Preview – clicks are not counted',
  },
};

/** German if the browser prefers German, English for everything else. */
export function pickLang(languages = []) {
  for (const lang of languages) {
    const l = String(lang).toLowerCase();
    if (l.startsWith('de')) return 'de';
    if (l.startsWith('en')) return 'en';
  }
  return 'en';
}

export function translator(lang) {
  const table = STRINGS[lang] || STRINGS.en;
  return (key, vars = {}) =>
    (table[key] ?? STRINGS.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

export const LOCALES = { de: 'de-DE', en: 'en-GB' };
