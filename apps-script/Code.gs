/**
 * Solakon Add-to-Calendar — anonymous tracking endpoint (Google Apps Script, bound to a Google Sheet).
 *
 * Setup (details in README → "Google Sheet tracking"):
 *   1. Google Sheet → Extensions → Apps Script → paste this file → Save.
 *   2. Select function "setup" → Run → allow access. Copy the STATS_KEY from the execution log.
 *   3. Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone → Deploy.
 *   4. Copy the web app URL (ends with /exec) into the dashboard settings.
 * After editing this code: Deploy → Manage deployments → Edit → Version: New version (keeps the same URL).
 *
 * Privacy: no IP addresses, no raw user agents, no personal data. Only coarse, whitelisted values are stored.
 */

const LOG_SHEET = 'Log';
const SUMMARY_SHEET = 'Summary';
const COLUMNS = [
  'timestamp', 'event_id', 'action', 'calendar', 'was_recommended', 'os', 'browser', 'device', 'in_app',
  'language', 'timezone', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'page_session', 'app_version',
];
const ACTIONS = ['view', 'add', 'not_found'];
const CALENDARS = ['apple', 'google', 'outlook', 'outlookcom', 'office365', 'yahoo', 'ics'];
const OS_VALUES = ['ios', 'android', 'macos', 'windows', 'other'];

// Solakon brand colors (sk-gray-800, sk-white, sk-yellow-100, sk-gray-600)
const COLORS = { header: '#212121', onHeader: '#FFFFFF', totals: '#FFF8CD', muted: '#4E4E4E' };

// ============================================================================ web app

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const row = toRow_(data);
    if (!row) return text_('ignored');
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      logSheet_().appendRow(row);
    } finally {
      lock.releaseLock();
    }
    return text_('ok');
  } catch (err) {
    console.error(err);
    return text_('error');
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'ping') return json_({ ok: true });
  if (p.action === 'stats') {
    const key = PropertiesService.getScriptProperties().getProperty('STATS_KEY');
    if (!key || p.key !== key) return json_({ ok: false, error: 'unauthorized' });
    return json_(stats_());
  }
  return text_('Solakon add-to-calendar tracking endpoint is running.');
}

// ============================================================================ validation

/** Strips control characters, limits length, blocks spreadsheet formula injection, optional whitelist pattern. */
function clean_(value, maxLength, pattern) {
  let s = String(value === null || value === undefined ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength)
    .replace(/^[=+\-@]+/, '');
  if (pattern && s && !pattern.test(s)) return '';
  return s;
}

function toRow_(d) {
  const action = clean_(d.action, 20);
  if (ACTIONS.indexOf(action) === -1) return null;
  const eventId = clean_(d.event_id, 64, /^[a-z0-9-]+$/);
  if (!eventId && action !== 'not_found') return null;
  const calendar = clean_(d.calendar, 20);
  const os = clean_(d.os, 20);
  return [
    new Date(),
    eventId,
    action,
    CALENDARS.indexOf(calendar) !== -1 ? calendar : '',
    action === 'add' ? (d.was_recommended === true || d.was_recommended === 'true' ? 'yes' : 'no') : '',
    OS_VALUES.indexOf(os) !== -1 ? os : 'other',
    clean_(d.browser, 20, /^[a-z-]+$/),
    clean_(d.device, 10, /^[a-z]+$/),
    clean_(d.in_app, 20, /^[a-z-]+$/),
    clean_(d.language, 10, /^[A-Za-z-]+$/),
    clean_(d.timezone, 50, /^[A-Za-z0-9_\/+-]+$/),
    clean_(d.utm_source, 100),
    clean_(d.utm_medium, 100),
    clean_(d.utm_campaign, 100),
    clean_(d.utm_content, 100),
    clean_(d.page_session, 32, /^[a-f0-9]+$/),
    clean_(d.app_version, 20, /^[0-9.]+$/),
  ];
}

// ============================================================================ stats for the dashboard

function stats_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('stats');
  if (cached) return JSON.parse(cached);

  const result = { ok: true, generatedAt: new Date().toISOString(), totals: { views: 0, adds: 0, notFound: 0 }, events: {} };
  const sheet = logSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    // Columns B..F: event_id, action, calendar, was_recommended, os
    const values = sheet.getRange(2, 2, lastRow - 1, 5).getValues();
    values.forEach(function (r) {
      const id = r[0];
      const action = r[1];
      const calendar = r[2];
      const os = r[4];
      if (action === 'not_found') {
        result.totals.notFound++;
        return;
      }
      if (!id) return;
      const ev = result.events[id] || (result.events[id] = { views: 0, adds: 0, calendars: {}, os: {} });
      if (action === 'view') {
        ev.views++;
        result.totals.views++;
        ev.os[os] = (ev.os[os] || 0) + 1;
      } else if (action === 'add') {
        ev.adds++;
        result.totals.adds++;
        if (calendar) ev.calendars[calendar] = (ev.calendars[calendar] || 0) + 1;
      }
    });
  }
  try {
    cache.put('stats', JSON.stringify(result), 60);
  } catch (err) {
    // larger than the 100 KB cache limit — just don't cache
  }
  return result;
}

// ============================================================================ setup

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const log = logSheet_();
  styleHeader_(log.getRange(1, 1, 1, COLUMNS.length));
  log.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');

  buildSummary_(ss);

  ['Sheet1', 'Tabelle1'].forEach(function (name) {
    const sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() === 0 && ss.getSheets().length > 2) ss.deleteSheet(sheet);
  });

  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('STATS_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('STATS_KEY', key);
  }
  console.log('Setup complete. STATS_KEY for the dashboard settings: ' + key);
}

/** Writes one test row — run it from the editor to check that logging works. */
function testTracking() {
  const res = doPost({ postData: { contents: JSON.stringify({ action: 'view', event_id: 'test', os: 'other', browser: 'other', device: 'desktop', page_session: 'abc123' }) } });
  console.log('doPost returned: ' + res.getContent() + ' — check the Log sheet for an event_id "test" row (delete it afterwards).');
}

function logSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LOG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET, 0);
    sheet.appendRow(COLUMNS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function styleHeader_(range) {
  range.setBackground(COLORS.header).setFontColor(COLORS.onHeader).setFontWeight('bold');
}

function buildSummary_(ss) {
  const sheet = ss.getSheetByName(SUMMARY_SHEET) || ss.insertSheet(SUMMARY_SHEET, 0);
  sheet.clear();

  sheet.getRange('A1').setValue('Add-to-calendar tracking').setFontSize(14).setFontWeight('bold');

  // Totals
  sheet.getRange('A2:H2').setValues([['Total views', '', 'Total adds', '', 'Add rate', '', 'Broken-link clicks', '']]);
  sheet.getRange('B2').setFormula('=COUNTIF(Log!C:C,"view")');
  sheet.getRange('D2').setFormula('=COUNTIF(Log!C:C,"add")');
  sheet.getRange('F2').setFormula('=IFERROR(D2/B2,0)').setNumberFormat('0%');
  sheet.getRange('H2').setFormula('=COUNTIF(Log!C:C,"not_found")');
  sheet.getRange('A2:H2').setBackground(COLORS.totals).setFontWeight('bold');

  // Group labels
  sheet.getRange('A4').setValue('Per event');
  sheet.getRange('E4').setValue('Adds by calendar');
  sheet.getRange('L4').setValue('Views by OS');
  sheet.getRange('R4').setValue('Per day');
  sheet.getRange('A4:T4').setFontWeight('bold').setFontColor(COLORS.muted);

  // Headers (calendar / OS headers must match the values in the Log sheet)
  const headers = ['event', 'views', 'adds', 'add rate'].concat(CALENDARS, OS_VALUES, ['', 'day', 'views', 'adds']);
  sheet.getRange(5, 1, 1, headers.length).setValues([headers]);
  styleHeader_(sheet.getRange(5, 1, 1, headers.length));
  sheet.getRange('Q5').setBackground(null);
  sheet.setFrozenRows(5);

  // Per-event table
  sheet.getRange('A6').setFormula('=IFERROR(SORT(UNIQUE(FILTER(Log!B2:B, Log!B2:B<>""))), "")');
  sheet.getRange('B6').setFormula('=ARRAYFORMULA(IF(A6:A="", "", COUNTIFS(Log!B2:B, A6:A, Log!C2:C, "view")))');
  sheet.getRange('C6').setFormula('=ARRAYFORMULA(IF(A6:A="", "", COUNTIFS(Log!B2:B, A6:A, Log!C2:C, "add")))');
  sheet.getRange('D6').setFormula('=ARRAYFORMULA(IF(A6:A="", "", IFERROR(C6:C/B6:B, 0)))');
  sheet.getRange('D6:D').setNumberFormat('0%');
  const calendarCols = ['E', 'F', 'G', 'H', 'I', 'J', 'K'];
  calendarCols.forEach(function (col) {
    sheet.getRange(col + '6').setFormula('=ARRAYFORMULA(IF($A6:$A="", "", COUNTIFS(Log!$B$2:$B, $A6:$A, Log!$C$2:$C, "add", Log!$D$2:$D, ' + col + '$5)))');
  });
  const osCols = ['L', 'M', 'N', 'O', 'P'];
  osCols.forEach(function (col) {
    sheet.getRange(col + '6').setFormula('=ARRAYFORMULA(IF($A6:$A="", "", COUNTIFS(Log!$B$2:$B, $A6:$A, Log!$C$2:$C, "view", Log!$F$2:$F, ' + col + '$5)))');
  });

  // Per-day table (newest first)
  sheet.getRange('R6').setFormula('=IFERROR(SORT(UNIQUE(FILTER(INT(Log!A2:A), Log!A2:A<>"")), 1, FALSE), "")');
  sheet.getRange('R6:R').setNumberFormat('yyyy-mm-dd');
  sheet.getRange('S6').setFormula('=ARRAYFORMULA(IF(R6:R="", "", COUNTIFS(Log!A2:A, ">="&R6:R, Log!A2:A, "<"&(R6:R+1), Log!C2:C, "view")))');
  sheet.getRange('T6').setFormula('=ARRAYFORMULA(IF(R6:R="", "", COUNTIFS(Log!A2:A, ">="&R6:R, Log!A2:A, "<"&(R6:R+1), Log!C2:C, "add")))');

  sheet.setColumnWidth(1, 260);
  sheet.setColumnWidth(17, 24);
}

// ============================================================================ helpers

function text_(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
