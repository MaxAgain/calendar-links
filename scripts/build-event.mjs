#!/usr/bin/env node
// Fallback publisher: creates/updates an event without the dashboard.
// Usage: node scripts/build-event.mjs path/to/event-input.json
// Then commit + push the changed files in events/.
//
// Input example:
// { "id": "webinar-2026-11-19", "title": "…", "description": "…", "location": "Online",
//   "url": "https://…", "allDay": false, "start": "2026-11-19T18:00", "end": "2026-11-19T19:00",
//   "timezone": "Europe/Berlin", "reminderMinutes": 60 }
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../assets/config.js';
import { buildEvent, buildIcs, validateEvent, suggestId, upsertIndex, toJson } from '../assets/js/calendar.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const eventsDir = path.join(root, 'events');

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/build-event.mjs path/to/event-input.json');
  process.exit(1);
}

const input = JSON.parse(await readFile(inputPath, 'utf8'));
input.timezone ||= CONFIG.defaultTimezone;
input.id ||= suggestId(input.title, input.start);

const errors = validateEvent(input);
if (errors.length) {
  console.error('Invalid event:\n- ' + errors.join('\n- '));
  process.exit(1);
}

await mkdir(eventsDir, { recursive: true });
const jsonPath = path.join(eventsDir, `${input.id}.json`);
const previous = existsSync(jsonPath) ? JSON.parse(await readFile(jsonPath, 'utf8')) : null;
const event = buildEvent(input, { uidDomain: CONFIG.uidDomain, previous });

const indexPath = path.join(eventsDir, 'index.json');
const index = existsSync(indexPath) ? JSON.parse(await readFile(indexPath, 'utf8')) : null;

await writeFile(jsonPath, toJson(event));
await writeFile(path.join(eventsDir, `${event.id}.ics`), buildIcs(event));
await writeFile(indexPath, toJson(upsertIndex(index, event)));

console.log(`${previous ? 'Updated' : 'Created'} event "${event.title}" (sequence ${event.sequence})`);
console.log(`Link: <site>/e/?id=${event.id}`);
