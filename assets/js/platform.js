// Detects OS / browser / in-app browser from the user agent and picks the recommended calendar.
// Only coarse, parsed values leave this module — the raw user agent is never tracked.

export function detectPlatform(ua = '', { maxTouchPoints = 0 } = {}) {
  const has = (re) => re.test(ua);

  let os = 'other';
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

  let device = 'desktop';
  if (os === 'ios') device = has(/iPad/) || (has(/Macintosh/) && maxTouchPoints > 1) ? 'tablet' : 'mobile';
  else if (os === 'android') device = has(/Mobile/) ? 'mobile' : 'tablet';

  return { os, browser, device, inApp };
}

/** The calendar we highlight as the main button for this device. */
export function recommendCalendar(platform) {
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

/** iOS only hands .ics files to Apple Calendar from Safari — other browsers and in-app browsers fail. */
export function needsSafariHint(platform) {
  return platform.os === 'ios' && (platform.browser !== 'safari' || Boolean(platform.inApp));
}

export function isMobile(platform) {
  return platform.device === 'mobile' || platform.device === 'tablet';
}
