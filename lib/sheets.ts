// Google Sheets integration: uses the Google account a staff member signed in with (via Clerk).
// Writes into a spreadsheet the staff member already has. That needs the `spreadsheets` scope:
// `drive.file` only reaches files the app created itself.
import { clerkClient } from '@clerk/nextjs/server';
import {
  COLORS,
  ExistingRows,
  KEY_COLUMNS,
  SUMMARY_HEADERS,
  columnLetter,
  hasStandardLayout,
  layoutRow,
  planHeader,
  summaryFormulas,
  type LogLayout,
} from './sheet-layout';

export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

export type GoogleErrorCode = 'no_google_account' | 'missing_scope' | 'token_failed' | 'api_error';

export class GoogleError extends Error {
  constructor(public code: GoogleErrorCode, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------- tokens

async function googleToken(userId: string) {
  try {
    const client = await clerkClient();
    const { data } = await client.users.getUserOauthAccessToken(userId, 'google');
    return data[0] ?? null;
  } catch (err) {
    throw new GoogleError('token_failed', `Could not get a Google token from Clerk: ${(err as Error).message}`);
  }
}

export async function hasSheetsAccess(userId: string): Promise<{ google: boolean; scope: boolean }> {
  try {
    const token = await googleToken(userId);
    return { google: Boolean(token), scope: Boolean(token?.scopes?.includes(SHEETS_SCOPE)) };
  } catch {
    return { google: false, scope: false };
  }
}

export async function getGoogleAccessToken(userId: string): Promise<string> {
  const token = await googleToken(userId);
  if (!token) throw new GoogleError('no_google_account', 'The connected user has no Google account linked anymore.');
  if (!token.scopes?.includes(SHEETS_SCOPE)) {
    throw new GoogleError('missing_scope', 'Google Sheets access was not granted (or was revoked).');
  }
  return token.token;
}

async function google<T>(token: string, method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    throw new GoogleError('api_error', `Google API ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

const cellFormat = (sheetId: number, range: Record<string, number>, format: Record<string, unknown>, fields: string) => ({
  repeatCell: { range: { sheetId, ...range }, cell: { userEnteredFormat: format }, fields: `userEnteredFormat(${fields})` },
});

const headerFormat = { backgroundColor: COLORS.header, textFormat: { foregroundColor: COLORS.onHeader, bold: true } };

/** A tab name inside an A1 range: 'Log'!A1, with quotes doubled. */
const tabRange = (tab: string, range: string) => `'${tab.replace(/'/g, "''")}'!${range}`;

interface SheetProps {
  sheetId: number;
  title: string;
  gridProperties?: { rowCount?: number; columnCount?: number };
}

export interface SpreadsheetInfo {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  sheets: SheetProps[];
}

/** Reads the spreadsheet's title and tabs. Fails if the user cannot open it. */
export async function getSpreadsheet(token: string, spreadsheetId: string): Promise<SpreadsheetInfo> {
  try {
    const data = await google<{ spreadsheetId: string; spreadsheetUrl: string; properties: { title: string }; sheets: { properties: SheetProps }[] }>(
      token,
      'GET',
      `${SHEETS_API}/${spreadsheetId}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties(sheetId,title,gridProperties)`,
    );
    return { spreadsheetId: data.spreadsheetId, spreadsheetUrl: data.spreadsheetUrl, title: data.properties.title, sheets: data.sheets.map((s) => s.properties) };
  } catch (err) {
    if (err instanceof GoogleError && /Google API (403|404)/.test(err.message)) {
      throw new GoogleError('api_error', 'This spreadsheet could not be opened. Check the link and make sure your Google account can edit the sheet.');
    }
    throw err;
  }
}

async function addTab(token: string, spreadsheetId: string, title: string, frozenRowCount: number): Promise<SheetProps> {
  const res = await google<{ replies: { addSheet: { properties: SheetProps } }[] }>(token, 'POST', `${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    requests: [{ addSheet: { properties: { title, gridProperties: { frozenRowCount } } } }],
  });
  return res.replies[0].addSheet.properties;
}

/**
 * Makes the log tab ready to receive rows and returns where each column lives. Adds the tab if it is missing,
 * writes the header into an empty tab, and adds missing columns after the last header cell. Never writes into a
 * cell that already has content.
 */
export async function prepareLogTab(token: string, spreadsheetId: string, tab: string): Promise<LogLayout> {
  const info = await getSpreadsheet(token, spreadsheetId);
  const sheet = info.sheets.find((s) => s.title === tab) ?? (await addTab(token, spreadsheetId, tab, 1));

  const current = await google<{ values?: unknown[][] }>(token, 'GET', `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(tabRange(tab, '1:1'))}`);
  const plan = planHeader(current.values?.[0] ?? []);
  if (!plan.missing.length) return plan;

  const columnCount = sheet.gridProperties?.columnCount ?? 26;
  const requests: unknown[] = [];
  if (plan.width > columnCount) {
    requests.push({ appendDimension: { sheetId: sheet.sheetId, dimension: 'COLUMNS', length: plan.width - columnCount } });
  }
  requests.push(cellFormat(sheet.sheetId, { startRowIndex: 0, endRowIndex: 1, startColumnIndex: plan.start, endColumnIndex: plan.width }, headerFormat, 'backgroundColor,textFormat'));
  if (plan.start === 0) {
    // A fresh log: show timestamps as date and time.
    requests.push(cellFormat(sheet.sheetId, { startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 }, { numberFormat: { type: 'DATE_TIME', pattern: 'yyyy-mm-dd hh:mm:ss' } }, 'numberFormat'));
  }
  // Grow the grid first, so the header cells exist before they are written.
  await google(token, 'POST', `${SHEETS_API}/${spreadsheetId}:batchUpdate`, { requests });
  const range = tabRange(tab, `${columnLetter(plan.start)}1`);
  await google(token, 'PUT', `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    values: [plan.missing],
  });
  return plan;
}

/**
 * Adds a Summary tab with formulas over the log, but only if there is no Summary tab yet, the log tab is
 * called "Log" and its columns are in the standard order (the formulas refer to them by letter).
 */
export async function addSummaryTabIfPossible(token: string, spreadsheetId: string, tab: string, layout: LogLayout): Promise<boolean> {
  if (tab !== 'Log' || !hasStandardLayout(layout)) return false;
  const info = await getSpreadsheet(token, spreadsheetId);
  if (info.sheets.some((s) => s.title === 'Summary')) return false;
  const { sheetId: SUMMARY } = await addTab(token, spreadsheetId, 'Summary', 5);

  await google(token, 'POST', `${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: 'Summary!A1', values: [['Add-to-calendar tracking']] },
      {
        range: 'Summary!A2',
        values: [[
          'Total views', '=COUNTIF(Log!C:C,"view")',
          'Total adds', '=COUNTIF(Log!C:C,"add")',
          'Add rate', '=IFERROR(D2/B2,0)',
          'Broken-link clicks', '=COUNTIF(Log!C:C,"not_found")',
        ]],
      },
      { range: 'Summary!A4', values: [['Per event', '', '', '', 'Adds by calendar', '', '', '', '', '', '', 'Views by OS', '', '', '', '', '', 'Per day']] },
      { range: 'Summary!A5', values: [SUMMARY_HEADERS] },
      { range: 'Summary!A6', values: [summaryFormulas()] },
    ],
  });

  await google(token, 'POST', `${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    requests: [
      cellFormat(SUMMARY, { startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 }, { textFormat: { bold: true, fontSize: 14 } }, 'textFormat'),
      cellFormat(SUMMARY, { startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 8 }, { backgroundColor: COLORS.totals, textFormat: { bold: true } }, 'backgroundColor,textFormat'),
      cellFormat(SUMMARY, { startRowIndex: 1, endRowIndex: 2, startColumnIndex: 5, endColumnIndex: 6 }, { numberFormat: { type: 'PERCENT', pattern: '0%' } }, 'numberFormat'),
      cellFormat(SUMMARY, { startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 20 }, { textFormat: { bold: true, foregroundColor: COLORS.muted } }, 'textFormat'),
      cellFormat(SUMMARY, { startRowIndex: 4, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 16 }, headerFormat, 'backgroundColor,textFormat'),
      cellFormat(SUMMARY, { startRowIndex: 4, endRowIndex: 5, startColumnIndex: 17, endColumnIndex: 20 }, headerFormat, 'backgroundColor,textFormat'),
      cellFormat(SUMMARY, { startRowIndex: 5, startColumnIndex: 3, endColumnIndex: 4 }, { numberFormat: { type: 'PERCENT', pattern: '0%' } }, 'numberFormat'),
      cellFormat(SUMMARY, { startRowIndex: 5, startColumnIndex: 17, endColumnIndex: 18 }, { numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' } }, 'numberFormat'),
      { updateDimensionProperties: { range: { sheetId: SUMMARY, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 260 }, fields: 'pixelSize' } },
    ],
  });
  return true;
}

/** Reads the columns that identify a click, so rows already in the sheet are not added again. */
export async function readExistingRows(token: string, spreadsheetId: string, tab: string, layout: LogLayout): Promise<ExistingRows> {
  const params = new URLSearchParams({ majorDimension: 'COLUMNS', valueRenderOption: 'UNFORMATTED_VALUE' });
  for (const column of KEY_COLUMNS) {
    const letter = columnLetter(layout.index[column]);
    params.append('ranges', tabRange(tab, `${letter}2:${letter}`));
  }
  const res = await google<{ valueRanges: { values?: unknown[][] }[] }>(token, 'GET', `${SHEETS_API}/${spreadsheetId}/values:batchGet?${params}`);
  return new ExistingRows(Object.fromEntries(KEY_COLUMNS.map((column, i) => [column, res.valueRanges[i]?.values?.[0] ?? []])));
}

/** Appends rows below the last row of the log tab. RAW input: values are never interpreted as formulas. */
export async function appendLogRows(token: string, spreadsheetId: string, tab: string, layout: LogLayout, rows: (string | number)[][]): Promise<void> {
  const range = encodeURIComponent(tabRange(tab, `A1:${columnLetter(layout.width - 1)}1`));
  await google(token, 'POST', `${SHEETS_API}/${spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    values: rows.map((row) => layoutRow(row, layout)),
  });
}
