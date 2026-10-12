// Detects OS / browser / in-app browser from the user agent and picks the recommended calendar.
// Only coarse, parsed values are ever stored — never the raw user agent.
import type { CalendarId } from './calendar';

export type OsId = 'ios' | 'android' | 'macos' | 'windows' | 'other';
export const OS_VALUES: OsId[] = ['ios', 'android', 'macos', 'windows', 'other'];

export interface Platform {
  os: OsId;
  browser: string;
  device: 'mobile' | 'tablet' | 'desktop';
  inApp: string;
}

export function detectPlatform(ua = '', { maxTouchPoints = 0 }: { maxTouchPoints?: number } = {}): Platform {
  const has = (re: RegExp) => re.test(ua);

  let os: OsId = 'other';
  if (has(/iPhone|iPad|iPod/) || (has(/Macintosh/) && maxTouchPoints > 1)) os = 'ios'; // iPadOS reports as Mac
  else if (has(/Android/)) os = 'android';
  else if (has(/Windows/)) os = 'windows';
  else if (has(/Macintosh|Mac OS X/)) os = 'macos';

  let inApp = '';
  if (has(/FBAN|FBAV|FB_IAB/)) inApp = 'facebook';
  else if (has(/Instagram/)) inApp = 'instagram';
  else if (has(/LinkedInApp/)) inApp = 'linkedin';
  else if (has(/\bGSA\//)) inApp = 'google';
  else if (has(/GmailApp|\bGmail\b/)) inApp = 'gmail';
  else if (has(/Outlook-iOS|Outlook-Android/)) inApp = 'outlook';
  else if (os === 'android' && has(/; wv\)/)) inApp = 'webview';

  let browser = 'other';
  if (has(/EdgiOS|EdgA|Edg\//)) browser = 'edge';
  else if (has(/SamsungBrowser/)) browser = 'samsung';
  else if (has(/OPR\/|OPiOS|Opera/)) browser = 'opera';
  else if (has(/CriOS/)) browser = 'chrome';
  else if (has(/FxiOS|Firefox\//)) browser = 'firefox';
  else if (has(/Chrome\/|Chromium\//)) browser = 'chrome';
  else if (has(/Safari\//) && has(/Version\//)) browser = 'safari';
  else if (os === 'ios' && has(/AppleWebKit/) && !has(/Safari\//)) inApp = inApp || 'webview';

  let device: Platform['device'] = 'desktop';
  if (os === 'ios') device = has(/iPad/) || (has(/Macintosh/) && maxTouchPoints > 1) ? 'tablet' : 'mobile';
  else if (os === 'android') device = has(/Mobile/) ? 'mobile' : 'tablet';

  return { os, browser, device, inApp };
}

/** The calendar highlighted as the main button for this device. */
export function recommendCalendar(platform: Platform): CalendarId {
  switch (platform.os) {
    case 'ios':
    case 'macos':
      return 'apple';
    case 'android':
      return 'google';
    case 'windows':
      return 'outlook';
    default:
      return 'google';
  }
}

/** Secondary buttons per OS (the recommended one is shown separately). */
export const OTHER_CALENDARS: Record<OsId, CalendarId[]> = {
  ios: ['google', 'office365', 'outlookcom', 'yahoo'],
  macos: ['google', 'office365', 'outlookcom', 'yahoo', 'ics'],
  android: ['office365', 'outlookcom', 'yahoo', 'ics'],
  windows: ['google', 'office365', 'outlookcom', 'yahoo'],
  other: ['apple', 'office365', 'outlookcom', 'yahoo', 'ics'],
};

/** iOS only hands .ics files to Apple Calendar from Safari — other and in-app browsers fail. */
export function needsSafariHint(platform: Platform): boolean {
  return platform.os === 'ios' && (platform.browser !== 'safari' || Boolean(platform.inApp));
}

export function isMobile(platform: Platform): boolean {
  return platform.device === 'mobile' || platform.device === 'tablet';
}

/** Presets for the dashboard preview's device switcher. */
export const PREVIEW_PLATFORMS: Record<string, Platform> = {
  ios: { os: 'ios', browser: 'safari', device: 'mobile', inApp: '' },
  'ios-inapp': { os: 'ios', browser: 'other', device: 'mobile', inApp: 'gmail' },
  android: { os: 'android', browser: 'chrome', device: 'mobile', inApp: '' },
  windows: { os: 'windows', browser: 'edge', device: 'desktop', inApp: '' },
  macos: { os: 'macos', browser: 'safari', device: 'desktop', inApp: '' },
};
