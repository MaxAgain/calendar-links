// Pure spreadsheet layout helpers (no network, no Clerk) — shared by the Sheets client and the tests.
import { CALENDARS, tzOffsetMs } from './calendar';
import type { ClickRow } from './db/schema';
import { OS_VALUES } from './platform';

export const SHEET_TIMEZONE = 'Europe/Berlin';

export const LOG_COLUMNS = [
  'timestamp', 'event_id', 'action', 'calendar', 'was_recommended', 'os', 'browser', 'device', 'in_app',
  'language', 'timezone', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'page_session', 'app_version',
];

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
  ];
}

