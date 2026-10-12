import { after } from 'next/server';
import { getPublicEvent, insertClick } from '@/lib/events';
import { toClickRecord } from '@/lib/tracking';

const MAX_BODY_BYTES = 4_096;

// Anonymous beacon from the recipient page. Responds immediately; the insert runs after the
// response so recipients never wait for the database.
export async function POST(request: Request) {
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  const record = toClickRecord(data);
  if (!record) return new Response(null, { status: 204 });

  after(async () => {
    try {
      // Drop beacons for unknown events; only 'not_found' is meant to log broken links.
      if (record.action !== 'not_found' && !(record.eventId && (await getPublicEvent(record.eventId)))) return;
      await insertClick(record);
    } catch (err) {
      console.error('Could not store click', err);
    }
  });
  return new Response(null, { status: 204 });
}
