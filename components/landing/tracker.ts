// Fire-and-forget, anonymous tracking. Never blocks the page, never throws, stores nothing on the device.

function randomId(): string {
  try {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return Math.random().toString(16).slice(2, 18);
  }
}

export type Track = (action: 'view' | 'add' | 'not_found', data?: Record<string, unknown>) => void;

export function createTracker(url: string, base: Record<string, unknown>): Track {
  const pageSession = randomId(); // memory only: links a page view to its calendar click
  return (action, data = {}) => {
    const payload = JSON.stringify({ ...base, ...data, action, page_session: pageSession });
    try {
      // text/plain is CORS-safelisted and sendBeacon survives page navigation.
      const blob = new Blob([payload], { type: 'text/plain;charset=UTF-8' });
      if (navigator.sendBeacon?.(url, blob)) return;
    } catch {
      // fall through to fetch
    }
    try {
      fetch(url, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: payload }).catch(() => {});
    } catch {
      // tracking must never break the page
    }
  };
}

/** UTM parameters from the link (Klaviyo adds them when UTM tracking is enabled). */
export function utmParams(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const out: Record<string, string> = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
    const value = params.get(key);
    if (value) out[key] = value.slice(0, 100);
  }
  return out;
}

export function viewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}
