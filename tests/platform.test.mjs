import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPlatform, recommendCalendar, needsSafariHint } from '../assets/js/platform.js';
import { pickLang, translator, STRINGS } from '../assets/js/i18n.js';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
  iphoneInstagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0',
  iphoneGoogleApp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/340.0.0 Mobile/15E148 Safari/604.1',
  ipadDesktopMode: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  androidWebview: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  windowsEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  windowsFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
};

test('detects iPhone Safari → Apple Calendar without hint', () => {
  const p = detectPlatform(UA.iphoneSafari, { maxTouchPoints: 5 });
  assert.deepEqual(p, { os: 'ios', browser: 'safari', device: 'mobile', inApp: '' });
  assert.equal(recommendCalendar(p), 'apple');
  assert.equal(needsSafariHint(p), false);
});

test('iOS Chrome and in-app browsers get the "open in Safari" hint', () => {
  for (const ua of [UA.iphoneChrome, UA.iphoneInstagram, UA.iphoneGoogleApp]) {
    const p = detectPlatform(ua, { maxTouchPoints: 5 });
    assert.equal(p.os, 'ios');
    assert.equal(needsSafariHint(p), true, ua);
  }
  assert.equal(detectPlatform(UA.iphoneInstagram).inApp, 'instagram');
  assert.equal(detectPlatform(UA.iphoneGoogleApp).inApp, 'google');
});

test('iPad in desktop mode is detected as iOS tablet via touch points', () => {
  const p = detectPlatform(UA.ipadDesktopMode, { maxTouchPoints: 5 });
  assert.equal(p.os, 'ios');
  assert.equal(p.device, 'tablet');
  assert.equal(detectPlatform(UA.macSafari, { maxTouchPoints: 0 }).os, 'macos');
});

test('desktop and Android recommendations', () => {
  assert.equal(recommendCalendar(detectPlatform(UA.macChrome)), 'apple');
  assert.equal(recommendCalendar(detectPlatform(UA.androidChrome)), 'google');
  assert.equal(recommendCalendar(detectPlatform(UA.windowsEdge)), 'outlook');
  assert.equal(recommendCalendar(detectPlatform(UA.windowsFirefox)), 'outlook');
  assert.equal(recommendCalendar(detectPlatform(UA.linux)), 'google');
  assert.equal(detectPlatform(UA.windowsEdge).browser, 'edge');
  assert.equal(detectPlatform(UA.samsung).browser, 'samsung');
  assert.equal(detectPlatform(UA.androidWebview).inApp, 'webview');
  assert.equal(detectPlatform(UA.androidChrome).device, 'mobile');
});

test('language: German for German browsers, English otherwise', () => {
  assert.equal(pickLang(['de-DE', 'en-US']), 'de');
  assert.equal(pickLang(['en-US', 'de-DE']), 'en');
  assert.equal(pickLang(['fr-FR', 'de-AT']), 'de');
  assert.equal(pickLang(['fr-FR']), 'en');
  assert.equal(translator('de')('addTo', { calendar: 'Google Kalender' }), 'Zu Google Kalender hinzufügen');
});

test('German texts always use the formal "Sie"', () => {
  const informal = /\b(du|dein\w*|dir|dich)\b|\b(öffne|kopiere|prüfe|versuche|füge|aktiviere|klicke)\b/i;
  for (const [key, text] of Object.entries(STRINGS.de)) {
    assert.ok(!informal.test(text), `de.${key} uses informal German: "${text}"`);
  }
  assert.equal(Object.keys(STRINGS.de).sort().join(), Object.keys(STRINGS.en).sort().join(), 'DE and EN must have the same keys');
});
