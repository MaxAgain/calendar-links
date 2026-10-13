// Pure spreadsheet layout helpers (no network, no Clerk) — shared by the Sheets client and the tests.
import { CALENDARS, tzOffsetMs } from './calendar';
import type { ClickRow } from './db/schema';
import { OS_VALUES } from './platform';

export const SHEET_TIMEZONE = 'Europe/Berlin';

export const DEFAULT_LOG_TAB = 'Log';

// click_id comes last so the Summary formulas (columns A–Q) still match sheets made before it existed.
export const LOG_COLUMNS = [
  'timestamp', 'event_id', 'action', 'calendar', 'was_recommended', 'os', 'browser', 'device', 'in_app',
  'language', 'timezone', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'page_session', 'app_version',
  'click_id',
];

/** Columns of the original layout, which the Summary formulas refer to by letter. */
const SUMMARY_COLUMN_COUNT = 17;

const rgb = (hex: string) => ({
  red: parseInt(hex.slice(1, 3), 16) / 255,
  green: parseInt(hex.slice(3, 5), 16) / 255,
  blue: parseInt(hex.slice(5, 7), 16) / 255,
});

// Solakon brand colors: sk-gray-800, sk-white, sk-yellow-100, sk-gray-600
export const COLORS = { header: rgb('#212121'), onHeader: rgb('#FFFFFF'), totals: rgb('#FFF8CD'), muted: rgb('#4E4E4E') };

export const SUMMARY_HEADERS = ['event', 'views', 'adds', 'add rate', ...CALENDARS, ...OS_VALUES, '', 'day', 'views', 'adds'];

/** Row 6 of the Summary tab: self-expanding formulas over the Log tab (column letters match LOG_COLUMNS). */
export function summaryFormulas(): string[] {
  const calendarCols = ['E', 'F', 'G', 'H', 'I', 'J', 'K'];
  const osCols = ['L', 'M', 'N', 'O', 'P'];
  return [
    '=IFERROR(SORT(UNIQUE(FILTER(Log!B2:B, Log!B2:B<>""))), "")',
    '=ARRAYFORMULA(IF(A6:A="", "", COUNTIFS(Log!B2:B, A6:A, Log!C2:C, "view")))',
    '=ARRAYFORMULA(IF(A6:A="", "", COUNTIFS(Log!B2:B, A6:A, Log!C2:C, "add")))',
    '=ARRAYFORMULA(IF(A6:A="", "", IFERROR(C6:C/B6:B, 0)))',
    ...calendarCols.map((c) => `=ARRAYFORMULA(IF($A6:$A="", "", COUNTIFS(Log!$B$2:$B, $A6:$A, Log!$C$2:$C, "add", Log!$D$2:$D, ${c}$5)))`),
    ...osCols.map((c) => `=ARRAYFORMULA(IF($A6:$A="", "", COUNTIFS(Log!$B$2:$B, $A6:$A, Log!$C$2:$C, "view", Log!$F$2:$F, ${c}$5)))`),
    '',
    '=IFERROR(SORT(UNIQUE(FILTER(INT(Log!A2:A), Log!A2:A<>"")), 1, FALSE), "")',
    '=ARRAYFORMULA(IF(R6:R="", "", COUNTIFS(Log!A2:A, ">="&R6:R, Log!A2:A, "<"&(R6:R+1), Log!C2:C, "view")))',
    '=ARRAYFORMULA(IF(R6:R="", "", COUNTIFS(Log!A2:A, ">="&R6:R, Log!A2:A, "<"&(R6:R+1), Log!C2:C, "add")))',
  ];
}

/** Spreadsheet date serial in Berlin time (days since 1899-12-30), so Sheets shows local time. */
export function toSheetSerial(date: Date): number {
  return (date.getTime() + tzOffsetMs(date, SHEET_TIMEZONE)) / 86_400_000 + 25_569;
}

export function clickToRow(c: ClickRow): (string | number)[] {
  return [
    toSheetSerial(c.createdAt),
    c.eventId ?? '',
    c.action,
    c.calendar ?? '',
    c.wasRecommended === null ? '' : c.wasRecommended ? 'yes' : 'no',
    c.os, c.browser, c.device, c.inApp, c.language, c.timezone,
    c.utmSource, c.utmMedium, c.utmCampaign, c.utmContent, c.pageSession, c.appVersion,
    c.id,
  ];
}

// ---------------------------------------------------------------------------- existing sheets

/** Accepts a full Google Sheets URL or a bare spreadsheet ID. */
export function parseSpreadsheetId(input: string): string | null {
  const value = input.trim();
  const fromUrl = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  const id = fromUrl ?? value;
  return /^[a-zA-Z0-9_-]{20,}$/.test(id) ? id : null;
}

/** "Page Session" and "page_session" are the same column. */
export const normalizeHeader = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

export interface LogLayout {
  /** Position of each LOG_COLUMNS name in the sheet (0-based). */
  index: Record<string, number>;
  /** Number of header cells, so every appended row spans the whole header. */
  width: number;
}

/**
 * Maps LOG_COLUMNS onto an existing header row. Columns found by name keep their place; missing ones are
 * appended after the last header cell, so existing cells are never written. An empty row gets the full header.
 */
export function planHeader(existing: unknown[]): LogLayout & { missing: string[]; start: number } {
  const header = existing.map(normalizeHeader);
  while (header.length && !header[header.length - 1]) header.pop();
  const index: Record<string, number> = {};
  for (const column of LOG_COLUMNS) {
    const at = header.indexOf(column);
    if (at !== -1) index[column] = at;
  }
  const missing = LOG_COLUMNS.filter((column) => index[column] === undefined);
  missing.forEach((column, i) => (index[column] = header.length + i));
  return { index, width: header.length + missing.length, missing, start: header.length };
}

/** True when columns A–Q are the original layout, so the Summary formulas can refer to them by letter. */
export function hasStandardLayout(layout: LogLayout): boolean {
  return LOG_COLUMNS.slice(0, SUMMARY_COLUMN_COUNT).every((column, i) => layout.index[column] === i);
}

/** Places a clickToRow() row into the sheet's column order. Unmapped columns stay empty. */
export function layoutRow(row: (string | number)[], layout: LogLayout): (string | number)[] {
  const out: (string | number)[] = Array(layout.width).fill('');
  LOG_COLUMNS.forEach((column, i) => (out[layout.index[column]] = row[i] ?? ''));
  return out;
}

/** "A", "Z", "AA" … for a 0-based column index. */
export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** Columns read back to recognise rows that are already in the sheet. */
export const KEY_COLUMNS = ['click_id', 'timestamp', 'event_id', 'action', 'calendar', 'page_session'] as const;
type KeyColumn = (typeof KEY_COLUMNS)[number];
type KeyValues = Partial<Record<KeyColumn, unknown>>;

/**
 * Rows written before click_id existed are recognised by what they contain: session, action, calendar,
 * event and the timestamp to the second.
 */
function legacyKey(v: KeyValues): string | null {
  if (typeof v.timestamp !== 'number' || !v.page_session) return null;
  return [Math.round(v.timestamp * 86_400), v.page_session, v.action ?? '', v.calendar ?? '', v.event_id ?? ''].join('|');
}

export class ExistingRows {
  private ids = new Set<string>();
  private legacy = new Set<string>();

  /** `columns` maps each key column to its values below the header, top to bottom. */
  constructor(columns: Partial<Record<KeyColumn, unknown[]>> = {}) {
    const length = Math.max(0, ...Object.values(columns).map((values) => values?.length ?? 0));
    for (let i = 0; i < length; i++) {
      const v: KeyValues = Object.fromEntries(KEY_COLUMNS.map((c) => [c, columns[c]?.[i]]));
      if (v.click_id !== undefined && v.click_id !== '') this.ids.add(String(v.click_id));
      else {
        const key = legacyKey(v);
        if (key) this.legacy.add(key);
      }
    }
  }

  get size() {
    return this.ids.size + this.legacy.size;
  }

  /** Whether a clickToRow() row is already in the sheet. */
  has(row: (string | number)[]): boolean {
    const v = Object.fromEntries(KEY_COLUMNS.map((c) => [c, row[LOG_COLUMNS.indexOf(c)]])) as KeyValues;
    if (this.ids.has(String(v.click_id))) return true;
    const key = legacyKey(v);
    return key !== null && this.legacy.has(key);
  }

  add(row: (string | number)[]): void {
    this.ids.add(String(row[LOG_COLUMNS.indexOf('click_id')]));
  }
}

