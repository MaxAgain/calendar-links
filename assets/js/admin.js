// Dashboard: create events, publish them to the repo, copy links, see stats.
import { CONFIG } from '../config.js';
import {
  buildEvent, buildIcs, validateEvent, suggestId, upsertIndex, toJson, isPast, addDays,
  longestProviderUrl, MAX_SAFE_URL_LENGTH, ID_PATTERN,
} from './calendar.js';
import { createGitHub } from './github.js';
import { fetchStats, pingTracking, CALENDAR_LABELS } from './stats.js';
import { h, copyText } from './dom.js';

const $ = (selector) => document.querySelector(selector);
const SETTINGS_KEY = 'atc-dashboard-settings';
const pad = (n) => String(n).padStart(2, '0');

// =========================================================================== settings

function defaultSettings() {
  const defaults = {
    owner: '', repo: '', branch: 'main', token: '',
    siteUrl: new URL('../', location.href).href,
    trackingUrl: CONFIG.trackingUrl || '',
    statsKey: '',
  };
  // Hosted at <owner>.github.io/<repo>/ → prefill owner and repo.
  const match = /^([^.]+)\.github\.io$/i.exec(location.hostname);
  if (match) {
    defaults.owner = match[1];
    const first = location.pathname.split('/').filter(Boolean)[0];
    defaults.repo = first && first !== 'admin' ? first : `${match[1]}.github.io`;
  }
  return defaults;
}

function loadSettings() {
  try {
    return { ...defaultSettings(), ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return defaultSettings();
  }
}

function storeSettings(value) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
  } catch {
    toast('Settings could not be stored in this browser (private mode?). They will be lost on reload.', true);
  }
}

let settings = loadSettings();

const siteUrl = () => (settings.siteUrl || new URL('../', location.href).href).replace(/\/?$/, '/');
const canPublish = () => Boolean(settings.owner && settings.repo && settings.token);
const github = () => createGitHub({ ...settings, branch: settings.branch || 'main' });

function linkFor(id, utmContent = '') {
  const url = `${siteUrl()}e/?id=${id}`;
  return utmContent ? `${url}&utm_content=${encodeURIComponent(utmContent)}` : url;
}

// =========================================================================== UI helpers

const state = { index: null, stats: null, statsError: '' };

function msg(kind, ...content) {
  return h('div', { class: `msg msg--${kind}`, role: kind === 'error' ? 'alert' : 'status' }, h('div', {}, ...content));
}

function toast(text, isError = false) {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: 'toast', role: isError ? 'alert' : 'status' }, text);
  document.body.append(el);
  setTimeout(() => el.remove(), isError ? 8000 : 4000);
}

function showView(name) {
  for (const view of ['list', 'editor', 'published']) $(`#view-${view}`).hidden = view !== name;
  window.scrollTo(0, 0);
}

function formatEventDate(e) {
  if (e.allDay) {
    const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const d = (s) => new Date(`${s}T12:00:00Z`);
    return e.start === e.end ? `${fmt.format(d(e.start))} · all day` : `${fmt.format(d(e.start))} – ${fmt.format(d(e.end))} · all day`;
  }
  const dateFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: e.timezone });
  const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: e.timezone });
  const start = new Date(e.startUtc);
  const end = new Date(e.endUtc);
  return dateFmt.format(start) === dateFmt.format(end)
    ? `${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)} (${e.timezone})`
    : `${dateFmt.format(start)} ${timeFmt.format(start)} – ${dateFmt.format(end)} ${timeFmt.format(end)} (${e.timezone})`;
}

// =========================================================================== banner

function isLocalSite() {
  try {
    return /^(localhost|127\.|0\.0\.0\.0)/.test(new URL(siteUrl()).hostname);
  } catch {
    return true;
  }
}

function renderBanner() {
  const banner = $('#banner');
  banner.replaceChildren();
  if (!canPublish()) {
    banner.append(msg('info', 'To publish events, connect GitHub first: ', h('button', { class: 'btn btn--sm', type: 'button', onclick: openSettings }, 'Open settings')));
  } else if (isLocalSite()) {
    banner.append(msg('warn', 'The public site URL points to this computer, so copied links would not work in emails. Set the real site URL in ', h('button', { class: 'btn btn--sm', type: 'button', onclick: openSettings }, 'Settings'), '.'));
  }
  if (canPublish() && settings.trackingUrl && settings.trackingUrl !== CONFIG.trackingUrl) {
    banner.append(msg('warn', 'Tracking is configured here but not yet active on the live site. ', h('button', { class: 'btn btn--sm', type: 'button', onclick: applyTrackingUrl }, 'Activate tracking on the site')));
  }
}

// =========================================================================== data

async function loadIndex() {
  if (canPublish()) {
    const text = await github().readFile('events/index.json');
    return text ? JSON.parse(text) : { events: [] };
  }
  const res = await fetch(`${new URL('../events/index.json', location.href)}?v=${Date.now()}`, { cache: 'no-store' });
  if (res.status === 404) return { events: [] };
  if (!res.ok) throw new Error(`Could not load the event list (HTTP ${res.status}).`);
  return res.json();
}

async function loadEventFile(id) {
  if (canPublish()) {
    const text = await github().readFile(`events/${id}.json`);
    if (!text) throw new Error(`Event "${id}" was not found in the repository.`);
    return JSON.parse(text);
  }
  const res = await fetch(`${new URL(`../events/${id}.json`, location.href)}?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Event "${id}" could not be loaded (HTTP ${res.status}).`);
  return res.json();
}

async function refresh() {
  renderBanner();
  $('#event-list').replaceChildren(h('p', { class: 'muted' }, 'Loading events …'));
  try {
    state.index = await loadIndex();
  } catch (err) {
    state.index = null;
    $('#event-list').replaceChildren(msg('error', err.message));
    return;
  }
  renderList();
  loadStats();
}

async function loadStats() {
  if (!settings.trackingUrl || !settings.statsKey) {
    state.stats = null;
    state.statsError = '';
    renderList();
    return;
  }
  try {
    state.stats = await fetchStats(settings.trackingUrl, settings.statsKey);
    state.statsError = '';
  } catch (err) {
    state.stats = null;
    state.statsError = err.message;
  }
  renderList();
}

/** Writes event JSON + .ics + index in one commit, always based on the newest repo state. */
async function saveEvent(id, makeInput, { isNew = false, message }) {
  let saved;
  await github().commit(async (read) => {
    const [indexText, currentText] = await Promise.all([read('events/index.json'), read(`events/${id}.json`)]);
    const current = currentText ? JSON.parse(currentText) : null;
    if (isNew && current) throw new Error(`The link ID "${id}" is already used by another event. Please choose a different link ID.`);
    if (!isNew && !current) throw new Error(`Event "${id}" no longer exists in the repository.`);
    saved = buildEvent(makeInput(current), { uidDomain: CONFIG.uidDomain, previous: current });
    const index = indexText ? JSON.parse(indexText) : null;
    return [
      { path: `events/${saved.id}.json`, content: toJson(saved) },
      { path: `events/${saved.id}.ics`, content: buildIcs(saved) },
      { path: 'events/index.json', content: toJson(upsertIndex(index, saved)) },
    ];
  }, message);
  state.index = upsertIndex(state.index, saved);
  return saved;
}

async function waitUntilLive(event, stillWanted) {
  const url = `${siteUrl()}events/${event.id}.json`;
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline && stillWanted()) {
    try {
      const res = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
      if (res.ok && (await res.json()).updatedAt === event.updatedAt) return true;
    } catch {
      // not deployed yet / offline — keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  return false;
}

// =========================================================================== event list

function renderTotals() {
  const totals = $('#totals');
  totals.replaceChildren();
  if (state.statsError) {
    totals.append(msg('warn', `Stats unavailable: ${state.statsError}`));
    return;
  }
  const t = state.stats?.totals;
  if (!t) return;
  const rate = t.views ? Math.round((t.adds / t.views) * 100) : 0;
  const tile = (label, value) => h('div', { class: 'tile' }, h('div', { class: 'tile__label' }, label), h('div', { class: 'tile__value' }, value));
  totals.append(tile('Page views', t.views), tile('Added to calendar', t.adds), tile('Add rate', `${rate}%`));
  if (t.notFound) totals.append(tile('Broken link clicks', t.notFound));
}

function renderStats(id) {
  if (!settings.trackingUrl || !settings.statsKey) return h('p', { class: 'stats muted' }, 'Tracking not connected (Settings).');
  if (!state.stats) return h('p', { class: 'stats muted' }, state.statsError ? 'Stats unavailable.' : 'Loading stats …');
  const s = state.stats.events?.[id];
  if (!s || (!s.views && !s.adds)) return h('p', { class: 'stats muted' }, 'No clicks yet.');
  const rate = s.views ? Math.round((s.adds / s.views) * 100) : 0;
  const calendars = Object.entries(s.calendars || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const max = calendars[0]?.[1] || 1;
  return h('div', { class: 'stats' },
    h('div', { class: 'stats__numbers' },
      h('span', {}, h('strong', {}, s.views), ' views'),
      h('span', {}, h('strong', {}, s.adds), ' adds'),
      h('span', {}, h('strong', {}, `${rate}%`), ' add rate'),
    ),
    h('div', { class: 'bars' }, calendars.map(([calendar, n], i) =>
      h('div', { class: 'bar' },
        h('span', {}, CALENDAR_LABELS[calendar] || calendar),
        h('span', { class: 'bar__track' }, h('span', { class: `bar__fill${i === 0 ? ' bar__fill--top' : ''}`, style: `width:${Math.max(4, (n / max) * 100)}%` })),
        h('span', { class: 'bar__value' }, n),
      ))),
  );
}

function renderEventRow(e) {
  const status = e.archived ? ['archived', 'Archived'] : isPast(e) ? ['past', 'Past'] : ['upcoming', 'Upcoming'];
  const copyBtn = h('button', { class: 'btn btn--sm btn--primary', type: 'button' }, 'Copy link');
  copyBtn.addEventListener('click', async () => {
    if (await copyText(linkFor(e.id))) toast('Link copied — paste it into the Klaviyo button.');
  });
  return h('article', { class: `event${e.archived ? ' event--archived' : ''}` },
    h('div', {},
      h('h2', { class: 'event__title' }, e.title, h('span', { class: `badge badge--${status[0]}` }, status[1])),
      h('p', { class: 'event__meta' }, formatEventDate(e)),
      h('p', { class: 'event__meta' }, 'Link ID: ', h('code', {}, e.id)),
    ),
    renderStats(e.id),
    h('div', { class: 'event__actions' },
      copyBtn,
      h('a', { class: 'btn btn--sm', href: linkFor(e.id), target: '_blank', rel: 'noopener' }, 'Open'),
      h('button', { class: 'btn btn--sm', type: 'button', onclick: () => editExisting(e.id) }, 'Edit'),
      h('button', { class: 'btn btn--sm', type: 'button', onclick: () => editExisting(e.id, { duplicate: true }) }, 'Duplicate'),
      h('button', { class: 'btn btn--sm btn--link', type: 'button', onclick: () => toggleArchive(e.id) }, e.archived ? 'Restore' : 'Archive'),
    ),
  );
}

function renderList() {
  renderTotals();
  const list = $('#event-list');
  if (!state.index) return;
  const showArchived = $('#show-archived').checked;
  const events = (state.index.events || []).filter((e) => showArchived || !e.archived);
  if (!events.length) {
    list.replaceChildren(h('div', { class: 'panel empty' },
      h('p', {}, state.index.events?.length ? 'Only archived events exist.' : 'No events yet.'),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: () => openEditor() }, '+ Create an event'),
    ));
    return;
  }
  list.replaceChildren(...events.map(renderEventRow));
}

async function editExisting(id, { duplicate = false } = {}) {
  try {
    openEditor(await loadEventFile(id), { duplicate });
  } catch (err) {
    toast(err.message, true);
  }
}

async function toggleArchive(id) {
  if (!canPublish()) return openSettings();
  const entry = state.index?.events.find((e) => e.id === id);
  if (!entry) return;
  const archiving = !entry.archived;
  if (archiving && !confirm(`Archive "${entry.title}"?\n\nAnyone who clicks the link will see "event not available". You can restore it at any time.`)) return;
  toast(archiving ? 'Archiving …' : 'Restoring …');
  try {
    await saveEvent(id, (current) => ({ ...current, archived: archiving }), {
      message: `${archiving ? 'Archive' : 'Restore'} event "${entry.title}" (${id})`,
    });
    renderList();
    toast(archiving ? 'Archived. Live on the site in about a minute.' : 'Restored. Live on the site in about a minute.');
  } catch (err) {
    toast(err.message, true);
  }
}

// =========================================================================== editor

const form = $('#event-form');
const F = {
  title: $('#f-title'),
  description: $('#f-description'),
  location: $('#f-location'),
  url: $('#f-url'),
  allDay: $('#f-allday'),
  startDate: $('#f-start-date'),
  startTime: $('#f-start-time'),
  endDate: $('#f-end-date'),
  endTime: $('#f-end-time'),
  timezone: $('#f-timezone'),
  reminder: $('#f-reminder'),
  id: $('#f-id'),
};
let editor = { mode: 'new', previous: null, idTouched: false, dirty: false, showErrors: false };

function fillTimezones() {
  const common = ['Europe/Berlin', 'Europe/Vienna', 'Europe/Zurich', 'Europe/Amsterdam', 'Europe/Paris', 'Europe/London', 'UTC'];
  let all = [];
  try {
    all = Intl.supportedValuesOf('timeZone');
  } catch {
    all = [];
  }
  F.timezone.replaceChildren(
    h('optgroup', { label: 'Common' }, common.map((z) => h('option', { value: z }, z))),
    all.length ? h('optgroup', { label: 'All time zones' }, all.filter((z) => !common.includes(z)).map((z) => h('option', { value: z }, z))) : null,
  );
}

function addMinutes(date, time, minutes) {
  const [hh, mm] = time.split(':').map(Number);
  const total = hh * 60 + mm + minutes;
  const days = Math.floor(total / 1440);
  const rest = ((total % 1440) + 1440) % 1440;
  return { date: addDays(date, days), time: `${pad(Math.floor(rest / 60))}:${pad(rest % 60)}` };
}

function localDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function uniqueId(base) {
  const taken = new Set((state.index?.events || []).map((e) => e.id));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base.slice(0, 60)}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

function readForm() {
  const allDay = F.allDay.checked;
  return {
    id: F.id.value.trim().toLowerCase(),
    title: F.title.value,
    description: F.description.value,
    location: F.location.value,
    url: F.url.value.trim(),
    allDay,
    start: allDay ? F.startDate.value : `${F.startDate.value}T${F.startTime.value}`,
    end: allDay ? F.endDate.value : `${F.endDate.value}T${F.endTime.value}`,
    timezone: F.timezone.value,
    reminderMinutes: F.reminder.value ? Number(F.reminder.value) : null,
    archived: editor.previous?.archived || false,
  };
}

function openEditor(event = null, { duplicate = false } = {}) {
  const editing = Boolean(event) && !duplicate;
  editor = { mode: editing ? 'edit' : 'new', previous: editing ? event : null, idTouched: false, dirty: false, showErrors: false };
  form.reset();
  $('#form-messages').replaceChildren();

  if (event) {
    F.title.value = event.title;
    F.description.value = event.description || '';
    F.location.value = event.location || '';
    F.url.value = event.url || '';
    F.allDay.checked = Boolean(event.allDay);
    F.startDate.value = event.start.slice(0, 10);
    F.endDate.value = event.end.slice(0, 10);
    F.startTime.value = event.allDay ? '18:00' : event.start.slice(11, 16);
    F.endTime.value = event.allDay ? '19:00' : event.end.slice(11, 16);
    F.timezone.value = event.timezone;
    F.reminder.value = event.reminderMinutes ? String(event.reminderMinutes) : '';
    F.id.value = editing ? event.id : uniqueId(suggestId(event.title, event.start));
  } else {
    F.startDate.value = localDate(7);
    F.endDate.value = localDate(7);
    F.startTime.value = '18:00';
    F.endTime.value = '19:00';
    F.timezone.value = CONFIG.defaultTimezone;
    F.reminder.value = '60';
    F.id.value = '';
  }

  F.id.readOnly = editing;
  $('#editor-title').textContent = editing ? 'Edit event' : duplicate ? 'Duplicate event' : 'New event';
  $('#btn-publish').textContent = editing ? 'Publish changes' : 'Publish';
  syncAllDay();
  updateLinkPreview();
  renderFormMessages();
  showView('editor');
  sendPreview();
  F.title.focus();
}

function syncAllDay() {
  const allDay = F.allDay.checked;
  for (const input of [F.startTime, F.endTime]) {
    input.hidden = allDay;
    input.required = !allDay;
  }
}

function updateLinkPreview() {
  $('#f-link-preview').textContent = linkFor(F.id.value.trim().toLowerCase() || '…');
  $('#f-id-hint').firstChild.textContent = editor.mode === 'edit'
    ? 'Can’t be changed after publishing (links in sent emails would break): '
    : 'Becomes part of the link: ';
}

/** Shows errors (after the first publish attempt) and warnings. Returns true if there are blocking errors. */
function renderFormMessages() {
  const input = readForm();
  const errors = validateEvent(input);
  if (editor.mode === 'new' && ID_PATTERN.test(input.id) && state.index?.events.some((e) => e.id === input.id)) {
    errors.push(`The link ID "${input.id}" is already used. Please choose another one.`);
  }
  const warnings = [];
  if (!errors.length) {
    const draft = buildEvent(input, { uidDomain: CONFIG.uidDomain });
    if (isPast(draft)) warnings.push('This event is in the past. Recipients will see “has already taken place”.');
    if (longestProviderUrl(draft) > MAX_SAFE_URL_LENGTH) {
      warnings.push('The description is very long. Google/Outlook may cut it off — consider shortening it. (The Apple/.ics version keeps the full text.)');
    }
  }
  if (!canPublish()) warnings.push('GitHub is not connected yet — open Settings before publishing.');

  F.id.setAttribute('aria-invalid', String(editor.showErrors && errors.some((e) => /link ID/i.test(e))));
  F.title.setAttribute('aria-invalid', String(editor.showErrors && !input.title.trim()));

  const box = $('#form-messages');
  box.replaceChildren();
  if (editor.showErrors && errors.length) box.append(msg('error', h('ul', {}, errors.map((e) => h('li', {}, e)))));
  if (warnings.length) box.append(msg('warn', h('ul', {}, warnings.map((w) => h('li', {}, w)))));
  return errors.length > 0;
}

function onFormInput(e) {
  editor.dirty = true;
  const target = e?.target;
  if (target === F.id) editor.idTouched = true;
  if ((target === F.title || target === F.startDate) && editor.mode === 'new' && !editor.idTouched) {
    F.id.value = F.title.value.trim() ? uniqueId(suggestId(F.title.value, F.startDate.value)) : '';
  }
  if (target === F.allDay) syncAllDay();
  // Keep the end after the start when the start moves.
  if (target === F.startDate || target === F.startTime || target === F.allDay) {
    if (F.allDay.checked) {
      if (!F.endDate.value || F.endDate.value < F.startDate.value) F.endDate.value = F.startDate.value;
    } else if (F.startDate.value && F.startTime.value) {
      const start = `${F.startDate.value}T${F.startTime.value}`;
      const end = `${F.endDate.value}T${F.endTime.value}`;
      if (!F.endDate.value || !F.endTime.value || end <= start) {
        const next = addMinutes(F.startDate.value, F.startTime.value, 60);
        F.endDate.value = next.date;
        F.endTime.value = next.time;
      }
    }
  }
  updateLinkPreview();
  renderFormMessages();
  schedulePreview();
}

// --- live preview (the real landing page in an iframe, fed via postMessage)
const frame = $('#preview-frame');
let previewReady = false;
let previewTimer = 0;

window.addEventListener('message', (m) => {
  if (m.origin === location.origin && m.data?.type === 'atc-preview-ready') {
    previewReady = true;
    sendPreview();
  }
});

function draftEvent() {
  const input = readForm();
  input.id = ID_PATTERN.test(input.id) ? input.id : 'preview';
  input.title = input.title.trim() || 'Untitled event';
  if (validateEvent(input).length) return null;
  return buildEvent(input, { uidDomain: CONFIG.uidDomain, previous: editor.previous });
}

function sendPreview() {
  if (!previewReady || $('#view-editor').hidden) return;
  const event = draftEvent();
  if (!event) return;
  frame.contentWindow.postMessage({ type: 'atc-preview', event, platform: $('#preview-platform').value }, location.origin);
}

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(sendPreview, 200);
}

// --- publish
form.addEventListener('input', onFormInput);
form.addEventListener('change', onFormInput);
$('#preview-platform').addEventListener('change', sendPreview);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  editor.showErrors = true;
  if (renderFormMessages()) return;
  if (!canPublish()) {
    openSettings();
    return;
  }
  const button = $('#btn-publish');
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Publishing …';
  const input = readForm();
  const isNew = editor.mode === 'new';
  try {
    const saved = await saveEvent(input.id, () => input, {
      isNew,
      message: `${isNew ? 'Add' : 'Update'} event "${input.title.trim()}" (${input.id})`,
    });
    editor.dirty = false;
    showPublished(saved, { isNew });
  } catch (err) {
    $('#form-messages').prepend(msg('error', err.message));
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
});

$('#btn-cancel').addEventListener('click', () => {
  if (editor.dirty && !confirm('Discard your changes?')) return;
  editor.dirty = false;
  showView('list');
});

window.addEventListener('beforeunload', (e) => {
  if (!$('#view-editor').hidden && editor.dirty) e.preventDefault();
});

// =========================================================================== published view

let pollGeneration = 0;

function updatePublishedLink(id) {
  const link = linkFor(id, $('#utm-content').value.trim());
  $('#published-link').value = link;
  $('#btn-open-published').href = link;
}

async function showPublished(event, { isNew }) {
  showView('published');
  $('#published-title').textContent = event.title;
  $('#utm-content').value = '';
  $('#utm-content').oninput = () => updatePublishedLink(event.id);
  updatePublishedLink(event.id);

  const status = $('#publish-status');
  status.replaceChildren(
    h('div', { class: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Deploying to GitHub Pages … usually about a minute.'),
    h('p', { class: 'hint' }, isNew
      ? 'You can copy the link now — it starts working as soon as this says “Live”.'
      : 'The link stays the same. Changes reach recipients within ~10 minutes (browser/CDN caching).'),
  );
  const generation = ++pollGeneration;
  const live = await waitUntilLive(event, () => generation === pollGeneration && !$('#view-published').hidden);
  if (generation !== pollGeneration) return;
  status.replaceChildren(live
    ? msg('ok', h('strong', {}, 'Live ✓ '), 'The link is ready to use.')
    : msg('warn', 'Not live yet. Check the “Actions” tab of the GitHub repository for a failed “pages build and deployment”, then reload this page.'));
}

$('#btn-copy-published').addEventListener('click', async () => {
  if (await copyText($('#published-link').value)) toast('Link copied — paste it into the Klaviyo button.');
});

$('#btn-back').addEventListener('click', () => {
  pollGeneration++;
  showView('list');
  renderList();
});

// =========================================================================== settings dialog

const dialog = $('#settings-dialog');
const S = {
  owner: $('#s-owner'), repo: $('#s-repo'), branch: $('#s-branch'), token: $('#s-token'),
  siteUrl: $('#s-site'), trackingUrl: $('#s-tracking'), statsKey: $('#s-statskey'),
};

function openSettings() {
  for (const [key, input] of Object.entries(S)) input.value = settings[key] || '';
  $('#settings-messages').replaceChildren();
  if (!dialog.open) dialog.showModal();
}

function readSettingsForm() {
  const value = Object.fromEntries(Object.entries(S).map(([key, input]) => [key, input.value.trim()]));
  value.branch ||= 'main';
  if (value.siteUrl && !value.siteUrl.endsWith('/')) value.siteUrl += '/';
  return value;
}

function settingsProblems(value) {
  const problems = [];
  if (value.trackingUrl && /\/dev$/.test(value.trackingUrl)) {
    problems.push('The tracking URL ends with /dev — that only works for you. Use the /exec URL from “Deploy → Manage deployments”.');
  } else if (value.trackingUrl && !/^https:\/\/script\.google\.com\/.+\/exec$/.test(value.trackingUrl)) {
    problems.push('The tracking URL should look like https://script.google.com/macros/s/…/exec');
  }
  if (value.siteUrl && !/^https?:\/\//.test(value.siteUrl)) problems.push('The public site URL must start with https://');
  return problems;
}

$('#btn-save-settings').addEventListener('click', () => {
  const value = readSettingsForm();
  const problems = settingsProblems(value);
  if (problems.length) {
    $('#settings-messages').replaceChildren(msg('error', h('ul', {}, problems.map((p) => h('li', {}, p)))));
    return;
  }
  settings = value;
  storeSettings(settings);
  dialog.close();
  toast('Settings saved.');
  refresh();
});

$('#btn-close-settings').addEventListener('click', () => dialog.close());
$('#btn-settings').addEventListener('click', openSettings);

$('#btn-test-settings').addEventListener('click', async () => {
  const value = readSettingsForm();
  const box = $('#settings-messages');
  box.replaceChildren(msg('info', 'Testing …'));
  const results = [];
  if (value.owner && value.repo && value.token) {
    try {
      const info = await createGitHub(value).testConnection();
      results.push(msg('ok', `GitHub: connected to ${info.fullName} (branch ${value.branch}).`));
    } catch (err) {
      results.push(msg('error', `GitHub: ${err.message}`));
    }
  } else {
    results.push(msg('warn', 'GitHub: owner, repository and token are required to publish.'));
  }
  for (const problem of settingsProblems(value)) results.push(msg('error', problem));
  if (value.trackingUrl) {
    try {
      results.push((await pingTracking(value.trackingUrl))
        ? msg('ok', 'Tracking: Apps Script reachable.')
        : msg('error', 'Tracking: unexpected response from Apps Script.'));
    } catch {
      results.push(msg('error', 'Tracking: Apps Script not reachable. Is it deployed as web app with access “Anyone”?'));
    }
    if (value.statsKey) {
      try {
        await fetchStats(value.trackingUrl, value.statsKey);
        results.push(msg('ok', 'Stats: key accepted.'));
      } catch (err) {
        results.push(msg('error', `Stats: ${err.message}`));
      }
    }
  }
  box.replaceChildren(...results);
});

/** Writes the tracking URL into assets/config.js on the live site (keeps all other values). */
async function applyTrackingUrl() {
  if (!canPublish()) return openSettings();
  try {
    await github().commit(async (read) => {
      const current = await read('assets/config.js');
      const pattern = /"trackingUrl":\s*"[^"]*"/;
      if (!current || !pattern.test(current)) throw new Error('assets/config.js has an unexpected format — please edit the trackingUrl there manually.');
      return [{ path: 'assets/config.js', content: current.replace(pattern, `"trackingUrl": ${JSON.stringify(settings.trackingUrl)}`) }];
    }, 'Activate tracking URL');
    CONFIG.trackingUrl = settings.trackingUrl;
    renderBanner();
    toast('Tracking activated — live on the site in about a minute.');
  } catch (err) {
    toast(err.message, true);
  }
}

// =========================================================================== start

$('#btn-new').addEventListener('click', () => openEditor());
$('#btn-refresh').addEventListener('click', refresh);
$('#show-archived').addEventListener('change', renderList);

fillTimezones();
refresh();
if (!canPublish()) openSettings();
