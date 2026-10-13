import { describe, expect, it } from 'vitest';
import type { ClickRow } from '../lib/db/schema';
import {
  ExistingRows,
  LOG_COLUMNS,
  clickToRow,
  columnLetter,
  hasStandardLayout,
  layoutRow,
  parseSpreadsheetId,
  planHeader,
} from '../lib/sheet-layout';

const click = (overrides: Partial<ClickRow> = {}): ClickRow =>
  ({
    id: 42,
    createdAt: new Date('2026-10-01T10:00:00Z'),
    eventId: 'summer-sale',
    action: 'add',
    calendar: 'google',
    wasRecommended: true,
    os: 'ios',
    browser: 'safari',
    device: 'mobile',
    inApp: 'no',
    language: 'de',
    timezone: 'Europe/Berlin',
    utmSource: 'klaviyo',
    utmMedium: 'email',
    utmCampaign: 'sale',
    utmContent: '',
    pageSession: 'sess-1',
    appVersion: '2.0.0',
    ...overrides,
  }) as ClickRow;

describe('parseSpreadsheetId', () => {
  const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789-xy';

  it('reads the ID from a sheet URL', () => {
    expect(parseSpreadsheetId(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`)).toBe(id);
  });

  it('accepts a bare ID', () => {
    expect(parseSpreadsheetId(`  ${id} `)).toBe(id);
  });

  it('rejects anything else', () => {
    expect(parseSpreadsheetId('https://example.com/sheet')).toBeNull();
    expect(parseSpreadsheetId('')).toBeNull();
  });
});

describe('planHeader', () => {
  it('writes the full header into an empty tab', () => {
    const plan = planHeader([]);
    expect(plan.start).toBe(0);
    expect(plan.missing).toEqual(LOG_COLUMNS);
    expect(hasStandardLayout(plan)).toBe(true);
  });

  it('maps columns by name, whatever their order and spelling', () => {
    const plan = planHeader(['Notes', 'Event ID', 'Timestamp', 'action']);
    expect(plan.index.event_id).toBe(1);
    expect(plan.index.timestamp).toBe(2);
    expect(plan.index.action).toBe(3);
    expect(hasStandardLayout(plan)).toBe(false);
  });

  it('adds missing columns after the last header cell, never over an existing one', () => {
    const plan = planHeader(['timestamp', 'my column', '', 'event_id', '', '']);
    expect(plan.start).toBe(4);
    expect(plan.missing).not.toContain('timestamp');
    expect(plan.missing).not.toContain('event_id');
    expect(Math.min(...plan.missing.map((c) => plan.index[c]))).toBe(4);
    expect(plan.width).toBe(4 + plan.missing.length);
  });

  it('only adds click_id to a sheet made by the old version', () => {
    const plan = planHeader(LOG_COLUMNS.slice(0, -1));
    expect(plan.missing).toEqual(['click_id']);
    expect(hasStandardLayout(plan)).toBe(true);
  });
});

describe('layoutRow', () => {
  it('places values under the matching headers and leaves other columns empty', () => {
    const plan = planHeader(['Notes', 'action', 'event_id']);
    const row = layoutRow(clickToRow(click()), plan);
    expect(row).toHaveLength(plan.width);
    expect(row[0]).toBe('');
    expect(row[1]).toBe('add');
    expect(row[2]).toBe('summer-sale');
    expect(row[plan.index.click_id]).toBe(42);
  });
});

describe('ExistingRows', () => {
  it('recognises rows by click_id', () => {
    const existing = new ExistingRows({ click_id: [41, '42'] });
    expect(existing.has(clickToRow(click({ id: 42 })))).toBe(true);
    expect(existing.has(clickToRow(click({ id: 43 })))).toBe(false);
  });

  it('recognises rows written before click_id existed by their contents', () => {
    const old = clickToRow(click());
    const col = (name: string) => [old[LOG_COLUMNS.indexOf(name)]];
    const existing = new ExistingRows({
      timestamp: col('timestamp'),
      event_id: col('event_id'),
      action: col('action'),
      calendar: col('calendar'),
      page_session: col('page_session'),
    });
    expect(existing.has(clickToRow(click()))).toBe(true);
    expect(existing.has(clickToRow(click({ action: 'view', calendar: null })))).toBe(false);
    expect(existing.has(clickToRow(click({ createdAt: new Date('2026-10-01T10:00:05Z') })))).toBe(false);
  });

  it('remembers rows added during the run', () => {
    const existing = new ExistingRows();
    const row = clickToRow(click({ id: 7 }));
    expect(existing.has(row)).toBe(false);
    existing.add(row);
    expect(existing.has(row)).toBe(true);
  });
});

describe('columnLetter', () => {
  it('converts indexes to A1 letters', () => {
    expect([0, 25, 26, 51, 701, 702].map(columnLetter)).toEqual(['A', 'Z', 'AA', 'AZ', 'ZZ', 'AAA']);
  });
});
