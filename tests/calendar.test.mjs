import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  zonedTimeToUtc, addDays, formatUtcBasic, slugify, suggestId, buildEvent, validateEvent,
  escapeText, foldLine, buildIcs, googleUrl, outlookUrl, yahooUrl, isPast, upsertIndex, ID_PATTERN,
} from '../assets/js/calendar.js';

const NOW = new Date('2026-10-12T10:00:00Z');

const timed = (overrides = {}) => buildEvent({
  id: 'webinar-test',
  title: 'Webinar: Größe, Übung; Test',
  description: 'Zeile 1\nZeile 2',
  location: 'Online',
  url: 'https://example.com/join?a=1&b=2',
  allDay: false,
  start: '2026-10-20T18:00',
  end: '2026-10-20T19:00',
  timezone: 'Europe/Berlin',
  reminderMinutes: 60,
  ...overrides,
}, { uidDomain: 'cal.example.com', now: NOW });

test('zonedTimeToUtc handles summer time, winter time and DST switches', () => {
  assert.equal(zonedTimeToUtc('2026-10-20T18:00', 'Europe/Berlin').toISOString(), '2026-10-20T16:00:00.000Z'); // CEST
  assert.equal(zonedTimeToUtc('2026-10-25T18:00', 'Europe/Berlin').toISOString(), '2026-10-25T17:00:00.000Z'); // CET, day DST ends
  assert.equal(zonedTimeToUtc('2026-10-25T01:30', 'Europe/Berlin').toISOString(), '2026-10-24T23:30:00.000Z'); // still CEST
  assert.equal(zonedTimeToUtc('2027-03-28T10:00', 'Europe/Berlin').toISOString(), '2027-03-28T08:00:00.000Z'); // CEST, day DST starts
  assert.equal(zonedTimeToUtc('2026-12-01T09:00', 'America/New_York').toISOString(), '2026-12-01T14:00:00.000Z');
  assert.equal(zonedTimeToUtc('2026-12-31T23:30', 'UTC').toISOString(), '2026-12-31T23:30:00.000Z');
});

test('addDays rolls over months and years', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});

test('slugify replaces umlauts and special characters', () => {
  assert.equal(slugify('Größe & Übung: Ölpreis!'), 'groesse-uebung-oelpreis');
  assert.equal(suggestId('Solakon Webinar', '2026-10-20T18:00'), 'solakon-webinar-2026-10-20');
  assert.ok(ID_PATTERN.test(suggestId('x'.repeat(200), '2026-10-20')));
});

test('buildEvent computes UTC times and keeps identity across edits', () => {
  const event = timed();
  assert.equal(event.startUtc, '2026-10-20T16:00:00Z');
  assert.equal(event.endUtc, '2026-10-20T17:00:00Z');
  assert.equal(event.uid, 'webinar-test@cal.example.com');
  assert.equal(event.sequence, 0);

  const later = new Date('2026-10-13T10:00:00Z');
  const edited = buildEvent({ ...event, title: 'Neu' }, { uidDomain: 'other.example.com', now: later, previous: event });
  assert.equal(edited.uid, event.uid, 'UID must never change');
  assert.equal(edited.sequence, 1);
  assert.equal(edited.createdAt, event.createdAt);
  assert.equal(edited.updatedAt, '2026-10-13T10:00:00Z');
});

test('all-day events end at midnight after the last day', () => {
  const event = timed({ allDay: true, start: '2026-10-25', end: '2026-10-26' });
  assert.equal(event.startUtc, '2026-10-24T22:00:00Z');
  assert.equal(event.endUtc, '2026-10-26T23:00:00Z');
});

test('validateEvent catches missing and inconsistent input', () => {
  assert.deepEqual(validateEvent({ id: 'ok-id', title: 'T', start: '2026-10-20T18:00', end: '2026-10-20T19:00', timezone: 'Europe/Berlin' }), []);
  assert.equal(validateEvent({ id: 'Bad ID', title: '', start: '', end: '' }).length, 4);
  assert.match(validateEvent({ id: 'a', title: 'T', start: '2026-10-20T18:00', end: '2026-10-20T18:00' })[0], /after the start/);
  assert.match(validateEvent({ id: 'a', title: 'T', start: '2026-10-20T18:00', end: '2026-10-20T19:00', timezone: 'Mars/Base' })[0], /Time zone/);
  assert.match(validateEvent({ id: 'a', title: 'T', start: '2026-10-20T18:00', end: '2026-10-20T19:00', url: 'javascript:alert(1)' })[0], /https/);
  assert.deepEqual(validateEvent({ id: 'a', title: 'T', allDay: true, start: '2026-10-20', end: '2026-10-20' }), []);
});

test('escapeText escapes iCalendar special characters', () => {
  assert.equal(escapeText('a,b;c\\d\ne\r\nf'), 'a\\,b\\;c\\\\d\\ne\\nf');
});

test('foldLine keeps lines ≤ 75 octets and never splits characters or escapes', () => {
  const line = 'DESCRIPTION:' + 'äöü€😀\\n'.repeat(40);
  const folded = foldLine(line);
  for (const physical of folded.split('\r\n')) {
    assert.ok(Buffer.byteLength(physical, 'utf8') <= 75, `too long: ${physical}`);
    assert.ok(!physical.includes('�'));
    assert.ok(!/\\$/.test(physical.replace(/\\\\/g, '')), 'escape sequence split across lines');
  }
  assert.equal(folded.replace(/\r\n /g, ''), line, 'unfolding must restore the original line');
});

test('buildIcs produces a valid, CRLF-terminated calendar', () => {
  const ics = buildIcs(timed());
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(ics), 'all line breaks must be CRLF');
  const unfolded = ics.replace(/\r\n /g, '');
  assert.match(unfolded, /\r\nUID:webinar-test@cal\.example\.com\r\n/);
  assert.match(unfolded, /\r\nDTSTART:20261020T160000Z\r\n/);
  assert.match(unfolded, /\r\nDTEND:20261020T170000Z\r\n/);
  assert.match(unfolded, /\r\nSUMMARY:Webinar: Größe\\, Übung\\; Test\r\n/);
  assert.match(unfolded, /\r\nDESCRIPTION:Zeile 1\\nZeile 2\\n\\nhttps:\/\/example\.com\/join\?a=1&b=2\r\n/);
  assert.match(unfolded, /\r\nTRIGGER:-PT60M\r\n/);
  assert.match(unfolded, /\r\nMETHOD:PUBLISH\r\n/);
  for (const block of ['VCALENDAR', 'VEVENT', 'VALARM']) {
    assert.equal(unfolded.split(`BEGIN:${block}`).length, unfolded.split(`END:${block}`).length);
  }
});

test('buildIcs uses exclusive DATE values for all-day events and omits alarm when not set', () => {
  const ics = buildIcs(timed({ allDay: true, start: '2026-12-31', end: '2026-12-31', reminderMinutes: null }));
  assert.match(ics, /DTSTART;VALUE=DATE:20261231\r\n/);
  assert.match(ics, /DTEND;VALUE=DATE:20270101\r\n/);
  assert.ok(!ics.includes('VALARM'));
});

test('googleUrl encodes all fields', () => {
  const url = new URL(googleUrl(timed()));
  assert.equal(url.origin + url.pathname, 'https://calendar.google.com/calendar/render');
  assert.equal(url.searchParams.get('action'), 'TEMPLATE');
  assert.equal(url.searchParams.get('text'), 'Webinar: Größe, Übung; Test');
  assert.equal(url.searchParams.get('dates'), '20261020T160000Z/20261020T170000Z');
  assert.equal(url.searchParams.get('details'), 'Zeile 1\nZeile 2\n\nhttps://example.com/join?a=1&b=2');
  assert.equal(url.searchParams.get('location'), 'Online');
  assert.equal(url.searchParams.get('ctz'), 'Europe/Berlin');

  const allDay = new URL(googleUrl(timed({ allDay: true, start: '2026-10-20', end: '2026-10-21' })));
  assert.equal(allDay.searchParams.get('dates'), '20261020/20261022');
});

test('outlookUrl targets Outlook.com or Microsoft 365', () => {
  const live = new URL(outlookUrl(timed()));
  assert.equal(live.origin + live.pathname, 'https://outlook.live.com/calendar/0/deeplink/compose');
  assert.equal(live.searchParams.get('path'), '/calendar/action/compose');
  assert.equal(live.searchParams.get('rru'), 'addevent');
  assert.equal(live.searchParams.get('startdt'), '2026-10-20T16:00:00Z');
  assert.equal(live.searchParams.get('enddt'), '2026-10-20T17:00:00Z');
  assert.equal(live.searchParams.get('subject'), 'Webinar: Größe, Übung; Test');
  assert.equal(live.searchParams.get('allday'), null);

  const office = new URL(outlookUrl(timed({ allDay: true, start: '2026-10-20', end: '2026-10-20' }), { host: 'office' }));
  assert.equal(office.origin, 'https://outlook.office.com');
  assert.equal(office.searchParams.get('allday'), 'true');
  assert.equal(office.searchParams.get('enddt'), '2026-10-21');

  const mobile = new URL(outlookUrl(timed({ allDay: true, start: '2026-10-20', end: '2026-10-20' }), { mobile: true }));
  assert.equal(mobile.searchParams.get('enddt'), '2026-10-20');
});

test('yahooUrl handles timed and all-day events', () => {
  const url = new URL(yahooUrl(timed()));
  assert.equal(url.searchParams.get('st'), '20261020T160000Z');
  assert.equal(url.searchParams.get('et'), '20261020T170000Z');
  const allDay = new URL(yahooUrl(timed({ allDay: true, start: '2026-10-20', end: '2026-10-20' })));
  assert.equal(allDay.searchParams.get('dur'), 'allday');
  assert.equal(allDay.searchParams.get('st'), '20261020');
});

test('isPast compares against the end time', () => {
  const event = timed();
  assert.equal(isPast(event, new Date('2026-10-20T16:30:00Z')), false);
  assert.equal(isPast(event, new Date('2026-10-20T17:00:01Z')), true);
});

test('upsertIndex replaces existing entries and sorts newest first', () => {
  const a = timed({ id: 'a', start: '2026-10-20T18:00', end: '2026-10-20T19:00' });
  const b = timed({ id: 'b', start: '2026-11-20T18:00', end: '2026-11-20T19:00' });
  let index = upsertIndex(null, a);
  index = upsertIndex(index, b);
  index = upsertIndex(index, { ...a, title: 'A2' });
  assert.deepEqual(index.events.map((e) => e.id), ['b', 'a']);
  assert.equal(index.events[1].title, 'A2');
});

test('formatUtcBasic accepts ISO strings', () => {
  assert.equal(formatUtcBasic('2026-10-20T16:00:00Z'), '20261020T160000Z');
});
