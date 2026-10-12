// Google Sheets integration: uses the Google account a staff member signed in with (via Clerk).
// Scope `drive.file` only grants access to files this app creates — not to the user's other files.
import { clerkClient } from '@clerk/nextjs/server';
import { COLORS, LOG_COLUMNS, SHEET_TIMEZONE, SUMMARY_HEADERS, summaryFormulas } from './sheet-layout';

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
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
    return { google: Boolean(token), scope: Boolean(token?.scopes?.includes(DRIVE_FILE_SCOPE)) };
  } catch {
    return { google: false, scope: false };
  }
}

export async function getGoogleAccessToken(userId: string): Promise<string> {
  const token = await googleToken(userId);
  if (!token) throw new GoogleError('no_google_account', 'The connected user has no Google account linked anymore.');
  if (!token.scopes?.includes(DRIVE_FILE_SCOPE)) {
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

/** Creates the tracking spreadsheet in the user's Google Drive. */
export async function createTrackingSpreadsheet(token: string): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const SUMMARY = 0;
  const LOG = 1;
  const created = await google<{ spreadsheetId: string; spreadsheetUrl: string }>(token, 'POST', SHEETS_API, {
    // en_GB: formulas use commas as separators regardless of the viewer's language.
    properties: { title: 'Solakon Calendar Links – Tracking', locale: 'en_GB', timeZone: SHEET_TIMEZONE },
    sheets: [
      { properties: { sheetId: SUMMARY, title: 'Summary', index: 0, gridProperties: { frozenRowCount: 5 } } },
      { properties: { sheetId: LOG, title: 'Log', index: 1, gridProperties: { frozenRowCount: 1 } } },
    ],
  });
  const id = created.spreadsheetId;

  await google(token, 'POST', `${SHEETS_API}/${id}/values:batchUpdate`, {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: 'Log!A1', values: [LOG_COLUMNS] },
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

  const headerFormat = { backgroundColor: COLORS.header, textFormat: { foregroundColor: COLORS.onHeader, bold: true } };
  await google(token, 'POST', `${SHEETS_API}/${id}:batchUpdate`, {
    requests: [
      cellFormat(LOG, { startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: LOG_COLUMNS.length }, headerFormat, 'backgroundColor,textFormat'),
      cellFormat(LOG, { startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 }, { numberFormat: { type: 'DATE_TIME', pattern: 'yyyy-mm-dd hh:mm:ss' } }, 'numberFormat'),
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

  return { spreadsheetId: id, spreadsheetUrl: created.spreadsheetUrl };
}

/** Appends rows to the Log tab. RAW input: values are never interpreted as formulas. */
export async function appendLogRows(token: string, spreadsheetId: string, rows: (string | number)[][]): Promise<void> {
  const range = encodeURIComponent('Log!A:Q');
  await google(token, 'POST', `${SHEETS_API}/${spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    values: rows,
  });
}
