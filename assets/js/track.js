// Fire-and-forget, anonymous tracking to the Google Apps Script web app.
// Never blocks the page, never throws, stores nothing on the device.

function randomId() {
  try {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return Math.random().toString(16).slice(2, 18);
  }
}

/**
 * @param {string} url  Apps Script web app URL. Empty = tracking disabled.
 * @param {object} base Fields sent with every hit (event id, platform, UTM params …).
 */
export function createTracker(url, base = {}) {
  const pageSession = randomId(); // kept in memory only, links a page view to its calendar click
  return function track(action, data = {}) {
    if (!url) return;
    const payload = JSON.stringify({ ...base, ...data, action, page_session: pageSession });
    try {
      // text/plain is a CORS-safelisted type, so the browser sends no preflight request.
      const blob = new Blob([payload], { type: 'text/plain;charset=UTF-8' });
      if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return;
    } catch {
      // fall through to fetch
    }
    try {
      fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: payload,
      }).catch(() => {});
    } catch {
      // tracking must never break the page
    }
  };
}

/** UTM parameters from the link (Klaviyo adds them automatically when UTM tracking is enabled). */
export function utmParams(searchParams) {
  const out = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
    const value = searchParams.get(key);
    if (value) out[key] = value.slice(0, 100);
  }
  return out;
}
