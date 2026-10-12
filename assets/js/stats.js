// Reads aggregated tracking numbers from the Google Apps Script web app.

export async function fetchStats(trackingUrl, statsKey) {
  const url = new URL(trackingUrl);
  url.searchParams.set('action', 'stats');
  url.searchParams.set('key', statsKey);
  const res = await fetch(url, { redirect: 'follow', cache: 'no-store' });
  if (!res.ok) throw new Error(`Tracking endpoint returned HTTP ${res.status}`);
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Tracking endpoint did not return JSON. Check that the Apps Script is deployed with access "Anyone".');
  }
  if (!data.ok) throw new Error(data.error === 'unauthorized' ? 'Stats key is wrong (see the STATS_KEY in Apps Script).' : data.error || 'Unknown stats error');
  return data;
}

export async function pingTracking(trackingUrl) {
  const url = new URL(trackingUrl);
  url.searchParams.set('action', 'ping');
  const res = await fetch(url, { redirect: 'follow', cache: 'no-store' });
  const data = await res.json();
  return Boolean(data.ok);
}

export const CALENDAR_LABELS = {
  apple: 'Apple',
  google: 'Google',
  outlook: 'Outlook desktop',
  outlookcom: 'Outlook.com',
  office365: 'Microsoft 365',
  yahoo: 'Yahoo',
  ics: '.ics file',
};

export const OS_LABELS = { ios: 'iOS', android: 'Android', macos: 'macOS', windows: 'Windows', other: 'Other' };
