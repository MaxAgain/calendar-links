// Runs apps-script/Code.gs in a sandbox with mocked Google services.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadScript({ statsKey = 'secret' } = {}) {
  const rows = [['timestamp', 'event_id', 'action', 'calendar', 'was_recommended', 'os']];
  const sheet = {
    appendRow: (row) => rows.push(row),
    getLastRow: () => rows.length,
    getRange: (row, col, numRows, numCols) => ({
      getValues: () => rows.slice(row - 1, row - 1 + numRows).map((r) => r.slice(col - 1, col - 1 + numCols)),
    }),
  };
  const output = (content) => ({ content, mime: null, setMimeType(m) { this.mime = m; return this; }, getContent() { return this.content; } });
  const context = {
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => statsKey }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
    ContentService: { createTextOutput: output, MimeType: { TEXT: 'text', JSON: 'json' } },
    Utilities: { getUuid: () => 'uuid' },
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'), context);
  const post = (data) => context.doPost({ postData: { contents: JSON.stringify(data) } }).getContent();
  return { context, rows, post };
}

test('doPost stores whitelisted, sanitized values only', () => {
  const { rows, post } = loadScript();
  assert.equal(post({
    action: 'add', event_id: 'webinar-1', calendar: 'apple', was_recommended: true, os: 'ios',
    browser: 'safari', device: 'mobile', in_app: '', language: 'de-DE', timezone: 'Europe/Berlin',
    utm_campaign: '=HYPERLINK("http://evil")', page_session: 'abcdef0123', app_version: '1.0.0',
  }), 'ok');
  const row = rows.at(-1);
  assert.equal(row.length, 17);
  assert.equal(Object.prototype.toString.call(row[0]), '[object Date]');
  assert.deepEqual([...row.slice(1, 11)], ['webinar-1', 'add', 'apple', 'yes', 'ios', 'safari', 'mobile', '', 'de-DE', 'Europe/Berlin']);
  assert.ok(!String(row[13]).startsWith('='), 'formula injection must be neutralized');
});

test('doPost rejects unknown actions, bad ids and bad JSON', () => {
  const { rows, post, context } = loadScript();
  assert.equal(post({ action: 'delete', event_id: 'x' }), 'ignored');
  assert.equal(post({ action: 'view', event_id: 'Bad ID!' }), 'ignored');
  assert.equal(context.doPost({ postData: { contents: '{not json' } }).getContent(), 'error');
  assert.equal(rows.length, 1);
  // unknown calendar / os are normalized
  post({ action: 'add', event_id: 'a', calendar: 'evilcal', os: 'beos' });
  assert.equal(rows.at(-1)[3], '');
  assert.equal(rows.at(-1)[5], 'other');
  // broken links are still logged (to detect typos in emails)
  post({ action: 'not_found', event_id: '../../etc' });
  assert.equal(rows.at(-1)[2], 'not_found');
  assert.equal(rows.at(-1)[1], '');
});

test('doGet stats requires the key and aggregates per event', () => {
  const { context, post } = loadScript();
  post({ action: 'view', event_id: 'a', os: 'ios' });
  post({ action: 'view', event_id: 'a', os: 'windows' });
  post({ action: 'add', event_id: 'a', calendar: 'apple', os: 'ios' });
  post({ action: 'view', event_id: 'b', os: 'android' });
  post({ action: 'not_found', event_id: 'zzz' });

  const denied = JSON.parse(context.doGet({ parameter: { action: 'stats', key: 'wrong' } }).getContent());
  assert.deepEqual(denied, { ok: false, error: 'unauthorized' });

  const stats = JSON.parse(context.doGet({ parameter: { action: 'stats', key: 'secret' } }).getContent());
  assert.equal(stats.ok, true);
  assert.deepEqual(stats.totals, { views: 3, adds: 1, notFound: 1 });
  assert.deepEqual(stats.events.a, { views: 2, adds: 1, calendars: { apple: 1 }, os: { ios: 1, windows: 1 } });
  assert.equal(stats.events.b.views, 1);

  assert.deepEqual(JSON.parse(context.doGet({ parameter: { action: 'ping' } }).getContent()), { ok: true });
});
