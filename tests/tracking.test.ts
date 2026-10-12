import assert from 'node:assert/strict';
import { test } from 'vitest';
import { parseAcceptLanguage, pickLang } from '@/lib/i18n';
import { clickToRow, LOG_COLUMNS, SUMMARY_HEADERS, summaryFormulas, toSheetSerial } from '@/lib/sheet-layout';
import { toClickRecord } from '@/lib/tracking';

test('toClickRecord drops UTM values that contain an email address', () => {
  const record = toClickRecord({ action: 'add', event_id: 'webinar-1', utm_source: 'max@solakon.de', utm_campaign: 'spring' });
  assert.ok(record);
  assert.equal(record.utmSource, '');
  assert.equal(record.utmCampaign, 'spring');
});

test('toClickRecord keeps whitelisted, sanitized values only', () => {
  const record = toClickRecord({
    action: 'add', event_id: 'webinar-1', calendar: 'apple', was_recommended: true, os: 'ios',
    browser: 'safari', device: 'mobile', in_app: '', language: 'de-DE', timezone: 'Europe/Berlin',
    utm_campaign: '=HYPERLINK("http://evil")', page_session: 'abcdef0123', app_version: '2.0.0',
  });
  assert.ok(record);
  assert.equal(record.eventId, 'webinar-1');
  assert.equal(record.calendar, 'apple');
  assert.equal(record.wasRecommended, true);
  assert.equal(record.os, 'ios');
  assert.ok(!record.utmCampaign.startsWith('='), 'formula injection must be neutralized');
});

test('toClickRecord rejects unknown actions and bad ids, normalizes unknown values', () => {
  assert.equal(toClickRecord({ action: 'delete', event_id: 'x' }), null);
  assert.equal(toClickRecord({ action: 'view', event_id: 'Bad ID!' }), null);
  assert.equal(toClickRecord('nope'), null);
  assert.equal(toClickRecord(null), null);
  const odd = toClickRecord({ action: 'add', event_id: 'a', calendar: 'evilcal', os: 'beos', browser: 'Ch<rome>' });
  assert.equal(odd?.calendar, null);
  assert.equal(odd?.os, 'other');
  assert.equal(odd?.browser, '');
  // Broken links are still counted (to detect typos in sent emails), without the bogus id.
  const broken = toClickRecord({ action: 'not_found', event_id: '../../etc' });
  assert.equal(broken?.action, 'not_found');
  assert.equal(broken?.eventId, null);
  assert.equal(toClickRecord({ action: 'view', event_id: 'a' })?.wasRecommended, null);
});

test('Accept-Language parsing respects quality values', () => {
  assert.deepEqual(parseAcceptLanguage('en-US,en;q=0.5,de-DE;q=0.9'), ['en-US', 'de-DE', 'en']);
  assert.equal(pickLang(parseAcceptLanguage('fr-FR,de;q=0.8,en;q=0.5')), 'de');
  assert.equal(pickLang(parseAcceptLanguage(null)), 'en');
});

test('sheet rows match the Log columns and use Berlin-time date serials', () => {
  const row = clickToRow({
    id: 1, createdAt: new Date('2026-07-01T10:00:00Z'), eventId: 'e1', action: 'add', calendar: 'google', wasRecommended: false,
    os: 'android', browser: 'chrome', device: 'mobile', inApp: '', language: 'de-DE', timezone: 'Europe/Berlin',
    utmSource: 'klaviyo', utmMedium: 'email', utmCampaign: 'herbst', utmContent: '', pageSession: 'ab', appVersion: '2.0.0',
  });
  assert.equal(row.length, LOG_COLUMNS.length);
  assert.equal(row[4], 'no');
  // 2026-07-01 12:00 Berlin (CEST) → serial 46204.5
  assert.equal(toSheetSerial(new Date('2026-07-01T10:00:00Z')), 46204.5);
  assert.equal(summaryFormulas().length, SUMMARY_HEADERS.length, 'one formula per summary column');
});
