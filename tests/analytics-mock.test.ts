import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  ANALYTICS_RANGES,
  ANALYTICS_SAMPLE,
  getEventAnalytics,
  getOverviewAnalytics,
  parseRange,
  type AnalyticsRange,
  type EventAnalytics,
} from '@/lib/analytics';
import { buildEvent, CALENDARS, type CalendarEvent } from '@/lib/calendar';
import { DEVICE_LABELS, formatDay, formatDelta, formatNumber, formatPercent, LANGUAGE_LABELS, OS_LABELS } from '@/lib/format';
import { OS_VALUES } from '@/lib/platform';

const NOW = new Date('2026-10-13T10:00:00Z');
const TODAY = '2026-10-13';
const RANGES: AnalyticsRange[] = ['7d', '30d', '90d', 'all'];

/** Event created on `created` that takes place at `start` (all times in Europe/Berlin, one hour long). */
function fixture(id: string, created: string, start: string, archived = false): CalendarEvent {
  const end = `${start.slice(0, 11)}${String(Number(start.slice(11, 13)) + 1).padStart(2, '0')}${start.slice(13)}`;
  return buildEvent(
    { id, title: id, allDay: false, start, end, timezone: 'Europe/Berlin', archived },
    { uidDomain: 'cal.solakon.de', now: new Date(`${created}T09:00:00Z`) },
  );
}

const upcoming = fixture('webinar-upcoming', '2026-08-20', '2026-11-05T18:00');
const past = fixture('webinar-past', '2026-06-01', '2026-07-02T10:00');
const young = fixture('webinar-young', '2026-10-12', '2026-10-30T10:00');
const archived = fixture('webinar-archived', '2026-01-10', '2026-02-15T10:00', true);
const ancient = fixture('webinar-ancient', '2025-01-01', '2027-01-20T10:00');
const recent = ['a', 'b', 'c', 'd'].map((suffix, i) => fixture(`recent-${suffix}`, `2026-09-${String(20 + i * 2)}`, `2026-11-${String(10 + i)}T10:00`));
const EVENTS = [upcoming, past, young, archived, ...recent];

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** Every split of an event's numbers has to add up to its totals, and adds never exceed views. */
function assertConsistent(a: EventAnalytics) {
  const { totals } = a;
  assert.equal(sum(a.daily.map((d) => d.views)), totals.views);
  assert.equal(sum(a.daily.map((d) => d.adds)), totals.adds);
  assert.equal(sum(a.calendars.map((c) => c.adds)), totals.adds);
  assert.equal(sum(a.os.map((o) => o.views)), totals.views);
  assert.equal(sum(a.os.map((o) => o.adds)), totals.adds);
  assert.equal(sum(a.devices.map((d) => d.views)), totals.views);
  assert.equal(sum(a.devices.map((d) => d.adds)), totals.adds);
  assert.equal(a.inApp.inApp + a.inApp.browser, totals.views);
  assert.equal(sum(a.languages.map((l) => l.views)), totals.views);
  assert.equal(sum(a.languages.map((l) => l.adds)), totals.adds);
  assert.ok(sum(a.utm.map((u) => u.views)) <= totals.views);
  assert.ok(sum(a.utm.map((u) => u.adds)) <= totals.adds);
  assert.ok(totals.adds <= totals.views);
  assert.ok(totals.sessions <= totals.views);
  assert.equal(totals.addRate, totals.views > 0 ? totals.adds / totals.views : 0);
}

describe('getEventAnalytics', () => {
  test('is deterministic for the same input and differs between events', async () => {
    for (const range of RANGES) {
      assert.deepEqual(await getEventAnalytics(upcoming, range, NOW), await getEventAnalytics(upcoming, range, NOW));
    }
    const a = await getEventAnalytics(upcoming, '90d', NOW);
    const b = await getEventAnalytics(recent[0], '90d', NOW);
    assert.notDeepEqual(a.daily, b.daily);
  });

  test('a shorter window is always a suffix of a longer one', async () => {
    for (const event of EVENTS) {
      const d7 = (await getEventAnalytics(event, '7d', NOW)).daily;
      const d30 = (await getEventAnalytics(event, '30d', NOW)).daily;
      const d90 = (await getEventAnalytics(event, '90d', NOW)).daily;
      assert.deepEqual(d7, d30.slice(-7), event.id);
      assert.deepEqual(d30, d90.slice(-30), event.id);
    }
  });

  test('the series does not change when time moves on, it only grows', async () => {
    const earlier = (await getEventAnalytics(upcoming, 'all', NOW)).daily;
    const later = (await getEventAnalytics(upcoming, 'all', new Date(NOW.getTime() + 3 * 86_400_000))).daily;
    assert.equal(later.length, earlier.length + 3);
    assert.deepEqual(later.slice(0, earlier.length), earlier);
  });

  test('daily windows have the right length, end today and are zero-filled', async () => {
    for (const [range, length] of [['7d', 7], ['30d', 30], ['90d', 90]] as const) {
      const a = await getEventAnalytics(young, range, NOW);
      assert.equal(a.daily.length, length);
      assert.equal(a.daily.at(-1)?.date, TODAY);
      for (let i = 1; i < a.daily.length; i++) {
        const gap = Date.parse(a.daily[i].date) - Date.parse(a.daily[i - 1].date);
        assert.equal(gap, 86_400_000, 'consecutive days');
      }
    }
  });

  test("'all' starts on the creation day, 'previous' is null only for it", async () => {
    const all = await getEventAnalytics(upcoming, 'all', NOW);
    assert.equal(all.daily[0].date, '2026-08-20');
    assert.equal(all.daily.at(-1)?.date, TODAY);
    assert.equal(all.previous, null);
    for (const range of ['7d', '30d', '90d'] as const) {
      const a = await getEventAnalytics(upcoming, range, NOW);
      assert.notEqual(a.previous, null);
    }
  });

  test("'all' is capped at 400 days", async () => {
    const a = await getEventAnalytics(ancient, 'all', NOW);
    assert.equal(a.daily.length, 400);
    assert.equal(a.daily.at(-1)?.date, TODAY);
  });

  test("'previous' covers the window right before and matches the longer window", async () => {
    const d60 = (await getEventAnalytics(upcoming, '90d', NOW)).daily;
    const a = await getEventAnalytics(upcoming, '30d', NOW);
    const before = d60.slice(-60, -30);
    assert.equal(a.previous?.views, sum(before.map((d) => d.views)));
    assert.equal(a.previous?.adds, sum(before.map((d) => d.adds)));
  });

  test('adds never exceed views, anywhere', async () => {
    for (const event of EVENTS) {
      for (const range of RANGES) {
        const a = await getEventAnalytics(event, range, NOW);
        for (const d of a.daily) assert.ok(d.adds <= d.views, `${event.id} ${d.date}`);
        for (const c of a.calendars) assert.ok(c.recommended <= c.adds);
        for (const row of [...a.os, ...a.devices, ...a.languages, ...a.utm]) assert.ok(row.adds <= row.views);
        for (const totals of [a.totals, a.previous]) if (totals) assert.ok(totals.adds <= totals.views && totals.sessions <= totals.views);
      }
    }
  });

  test('has no data before the event was created', async () => {
    const a = await getEventAnalytics(young, '30d', NOW);
    for (const d of a.daily.filter((point) => point.date < '2026-10-12')) assert.deepEqual([d.views, d.adds], [0, 0], d.date);
    assert.equal(a.previous?.views, 0);
    assert.equal(a.previous?.addRate, 0);
    // The creation day and today can already hold visits; the numbers stay small.
    assert.ok(a.totals.views < 2000);
  });

  test('has no data after "now" and stops two weeks after the event ended', async () => {
    const early = await getEventAnalytics(upcoming, 'all', new Date('2026-08-25T10:00:00Z'));
    assert.equal(early.daily.at(-1)?.date, '2026-08-25');

    const a = await getEventAnalytics(past, '90d', NOW);
    for (const d of a.daily.filter((point) => point.date > '2026-07-16')) assert.deepEqual([d.views, d.adds], [0, 0], d.date);
    assert.ok(a.totals.views > 0, 'the last 90 days still contain the tail of the event');

    const future = fixture('webinar-future', '2026-12-01', '2027-01-10T10:00');
    const none = await getEventAnalytics(future, 'all', NOW);
    assert.equal(none.totals.views, 0);
  });

  test('archived events keep their historic data', async () => {
    const a = await getEventAnalytics(archived, 'all', NOW);
    assert.ok(a.totals.views > 100);
    assert.ok(a.totals.adds > 0);
  });

  test('has an email-send spike shortly after creation, then decays', async () => {
    const { daily } = await getEventAnalytics(upcoming, 'all', NOW);
    const views = daily.map((d) => d.views);
    const peak = views.indexOf(Math.max(...views));
    assert.ok(peak >= 1 && peak <= 4, `peak on day ${peak}`);
    assert.ok(Math.max(...views) > 5 * (sum(views.slice(-14)) / 14), 'the spike dwarfs the later baseline');
  });

  test('all breakdowns add up to the totals', async () => {
    for (const event of EVENTS) {
      for (const range of RANGES) assertConsistent(await getEventAnalytics(event, range, NOW));
    }
  });

  test('lists every calendar, OS, device and language, sorted', async () => {
    const a = await getEventAnalytics(upcoming, '90d', NOW);
    assert.deepEqual([...a.calendars.map((c) => c.calendar)].sort(), [...CALENDARS].sort());
    assert.deepEqual([...a.os.map((o) => o.key)].sort(), [...OS_VALUES].sort());
    assert.deepEqual(a.devices.map((d) => d.key).sort(), ['desktop', 'mobile', 'tablet']);
    assert.deepEqual(a.languages.map((l) => l.key).sort(), ['de', 'en', 'other']);
    for (const list of [a.os, a.devices, a.languages, a.utm]) {
      for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].views >= list[i].views);
    }
    for (let i = 1; i < a.calendars.length; i++) assert.ok(a.calendars[i - 1].adds >= a.calendars[i].adds);
  });

  test('calendar choice follows the platform and only recommends what recommendCalendar picks', async () => {
    const a = await getEventAnalytics(upcoming, 'all', NOW);
    const byCalendar = Object.fromEntries(a.calendars.map((c) => [c.calendar, c]));
    assert.ok(byCalendar.apple.adds > byCalendar.yahoo.adds);
    for (const calendar of ['office365', 'outlookcom', 'yahoo', 'ics'] as const) assert.equal(byCalendar[calendar].recommended, 0);
    assert.ok(byCalendar.apple.recommended > 0);
    assert.equal(a.os[0].key, 'ios');
    assert.equal(a.devices[0].key, 'mobile');
    assert.equal(a.languages[0].key, 'de');
  });

  test('looks plausible: add rate, sessions, in-app share, language mix, UTM rows', async () => {
    const a = await getEventAnalytics(upcoming, 'all', NOW);
    const { totals } = a;
    assert.ok(totals.addRate >= 0.1 && totals.addRate <= 0.5, `add rate ${totals.addRate}`);
    assert.ok(totals.sessions >= totals.views * 0.8 && totals.sessions <= totals.views);
    const inAppShare = a.inApp.inApp / totals.views;
    assert.ok(inAppShare >= 0.15 && inAppShare <= 0.4, `in-app ${inAppShare}`);
    const german = a.languages.find((l) => l.key === 'de')!.views / totals.views;
    assert.ok(german >= 0.75 && german <= 0.95, `german ${german}`);
    assert.ok(a.utm.length >= 1 && a.utm.length <= 8);
    assert.equal(a.utm[0].source, 'klaviyo');
    assert.ok(a.utm[0].campaign.startsWith(upcoming.id));
  });

  test('empty windows produce valid zero results', async () => {
    const a = await getEventAnalytics(past, '7d', NOW);
    assert.deepEqual(a.totals, { views: 0, adds: 0, addRate: 0, sessions: 0 });
    assert.deepEqual(a.utm, []);
    assert.equal(a.calendars.length, 7);
    assertConsistent(a);
  });

  test('survives a JSON round trip unchanged', async () => {
    for (const range of RANGES) {
      const a = await getEventAnalytics(upcoming, range, NOW);
      assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
    }
  });
});

describe('getOverviewAnalytics', () => {
  test('is deterministic and JSON-safe', async () => {
    for (const range of RANGES) {
      const a = await getOverviewAnalytics(EVENTS, range, NOW);
      assert.deepEqual(a, await getOverviewAnalytics(EVENTS, range, NOW));
      assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
    }
  });

  test('byEvent has every event id and totals are the sum of the events', async () => {
    for (const range of RANGES) {
      const o = await getOverviewAnalytics(EVENTS, range, NOW);
      assert.deepEqual(Object.keys(o.byEvent).sort(), EVENTS.map((e) => e.id).sort());
      const totals = Object.values(o.byEvent);
      assert.equal(o.totals.views, sum(totals.map((t) => t.views)), range);
      assert.equal(o.totals.adds, sum(totals.map((t) => t.adds)), range);
      assert.equal(o.totals.sessions, sum(totals.map((t) => t.sessions)), range);
      assert.equal(o.totals.addRate, o.totals.views > 0 ? o.totals.adds / o.totals.views : 0);
      assert.equal(sum(o.daily.map((d) => d.views)), o.totals.views);
      assert.equal(sum(o.daily.map((d) => d.adds)), o.totals.adds);
      assert.equal(sum(o.calendars.map((c) => c.adds)), o.totals.adds);
      assert.ok(o.totals.adds <= o.totals.views && o.totals.sessions <= o.totals.views);
      for (const c of o.calendars) assert.ok(c.recommended <= c.adds);
      for (const d of o.daily) assert.ok(d.adds <= d.views);
    }
  });

  test('matches the per-event numbers for the same window', async () => {
    for (const range of ['7d', '30d', '90d'] as const) {
      const o = await getOverviewAnalytics(EVENTS, range, NOW);
      for (const event of EVENTS) {
        const a = await getEventAnalytics(event, range, NOW);
        assert.deepEqual(o.byEvent[event.id], a.totals, `${event.id} ${range}`);
      }
      const events = await Promise.all(EVENTS.map((e) => getEventAnalytics(e, range, NOW)));
      assert.equal(o.previous?.views, sum(events.map((a) => a.previous!.views)));
      assert.equal(o.previous?.adds, sum(events.map((a) => a.previous!.adds)));
      assert.deepEqual(
        o.daily.map((d) => d.views),
        o.daily.map((_, i) => sum(events.map((a) => a.daily[i].views))),
      );
    }
    const o = await getOverviewAnalytics(EVENTS, 'all', NOW);
    for (const event of EVENTS) assert.deepEqual(o.byEvent[event.id], (await getEventAnalytics(event, 'all', NOW)).totals, event.id);
  });

  test('daily windows: 7, 30, 90 days, or from the earliest creation day for all time', async () => {
    for (const [range, length] of [['7d', 7], ['30d', 30], ['90d', 90]] as const) {
      const o = await getOverviewAnalytics(EVENTS, range, NOW);
      assert.equal(o.daily.length, length);
      assert.equal(o.daily.at(-1)?.date, TODAY);
      assert.notEqual(o.previous, null);
    }
    const all = await getOverviewAnalytics(EVENTS, 'all', NOW);
    assert.equal(all.daily[0].date, '2026-01-10');
    assert.equal(all.previous, null);
    const capped = await getOverviewAnalytics([...EVENTS, ancient], 'all', NOW);
    assert.equal(capped.daily.length, 400);
  });

  test('topEvents are the best five by adds, sorted, without zero-add events', async () => {
    for (const range of RANGES) {
      const o = await getOverviewAnalytics(EVENTS, range, NOW);
      assert.ok(o.topEvents.length <= 5);
      for (let i = 1; i < o.topEvents.length; i++) assert.ok(o.topEvents[i - 1].adds >= o.topEvents[i].adds);
      for (const top of o.topEvents) {
        assert.ok(top.adds > 0);
        assert.deepEqual({ views: top.views, adds: top.adds, addRate: top.addRate }, {
          views: o.byEvent[top.id].views,
          adds: o.byEvent[top.id].adds,
          addRate: o.byEvent[top.id].addRate,
        });
      }
      const expected = Object.entries(o.byEvent).filter(([, t]) => t.adds > 0).length;
      assert.equal(o.topEvents.length, Math.min(5, expected));
    }
    const o = await getOverviewAnalytics(EVENTS, 'all', NOW);
    assert.equal(o.topEvents.length, 5);
    const outside = Object.entries(o.byEvent).filter(([id]) => !o.topEvents.some((t) => t.id === id));
    for (const [, t] of outside) assert.ok(t.adds <= o.topEvents[4].adds);
  });

  test('counts a small share of broken-link hits that grows with the range', async () => {
    const results = await Promise.all(RANGES.map((range) => getOverviewAnalytics(EVENTS, range, NOW)));
    for (const o of results) {
      assert.ok(o.notFound >= Math.floor(o.totals.views * 0.009) && o.notFound <= Math.ceil(o.totals.views * 0.021), o.range);
    }
    assert.ok(results[0].notFound <= results[1].notFound && results[1].notFound <= results[2].notFound);
  });

  test('handles an empty event list', async () => {
    const o = await getOverviewAnalytics([], 'all', NOW);
    assert.deepEqual(o.totals, { views: 0, adds: 0, addRate: 0, sessions: 0 });
    assert.deepEqual(o.byEvent, {});
    assert.deepEqual(o.topEvents, []);
    assert.equal(o.notFound, 0);
    assert.equal(o.daily.length, 1);
  });
});

describe('range helpers', () => {
  test('parseRange accepts the known ranges and falls back to 30 days', () => {
    for (const { value } of ANALYTICS_RANGES) assert.equal(parseRange(value), value);
    for (const bad of [undefined, null, '', '14d', '30D', 7, {}, ['nope']]) assert.equal(parseRange(bad), '30d');
    assert.equal(parseRange(['90d', '7d']), '90d');
  });

  test('exposes the range options and the sample flag', () => {
    assert.deepEqual(ANALYTICS_RANGES.map((r) => r.label), ['7 days', '30 days', '90 days', 'All time']);
    assert.equal(ANALYTICS_SAMPLE, true);
  });
});

describe('format helpers', () => {
  test('labels', () => {
    assert.deepEqual(OS_LABELS, { ios: 'iOS', android: 'Android', macos: 'macOS', windows: 'Windows', other: 'Other' });
    assert.deepEqual(DEVICE_LABELS, { mobile: 'Mobile', tablet: 'Tablet', desktop: 'Desktop' });
    assert.deepEqual(LANGUAGE_LABELS, { de: 'German', en: 'English', other: 'Other' });
  });

  test('formatNumber groups thousands', () => {
    assert.equal(formatNumber(0), '0');
    assert.equal(formatNumber(999), '999');
    assert.equal(formatNumber(1234), '1,234');
    assert.equal(formatNumber(1234567), '1,234,567');
  });

  test('formatPercent', () => {
    assert.equal(formatPercent(0.234), '23.4%');
    assert.equal(formatPercent(0), '0.0%');
    assert.equal(formatPercent(1), '100.0%');
    assert.equal(formatPercent(0.5, 0), '50%');
    assert.equal(formatPercent(0.12345, 2), '12.35%');
    assert.equal(formatPercent(-0.00001), '0.0%');
  });

  test('formatDelta', () => {
    assert.deepEqual(formatDelta(112, 100), { value: 0.12, label: '+12.0%' });
    assert.equal(formatDelta(96.6, 100).label, '−3.4%');
    assert.ok(formatDelta(96.6, 100).value < 0);
    assert.deepEqual(formatDelta(100, 100), { value: 0, label: '0.0%' });
    assert.equal(formatDelta(0, 50).label, '−100.0%');
    assert.deepEqual(formatDelta(5, 0), { value: 1, label: 'New' });
    assert.deepEqual(formatDelta(0, 0), { value: 0, label: '0.0%' });
    assert.equal(formatDelta(100000.001, 100000).label, '0.0%');
  });

  test('formatDay is a short UTC day label', () => {
    assert.equal(formatDay('2026-10-13'), '13 Oct');
    assert.equal(formatDay('2026-01-02'), '2 Jan');
    assert.equal(formatDay('2026-12-31'), '31 Dec');
  });
});
