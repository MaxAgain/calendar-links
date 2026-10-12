import { buildIcs, ID_PATTERN } from '@/lib/calendar';
import { getPublicEvent } from '@/lib/events';

// Served as text/calendar: iOS/macOS Safari then shows the native "Add to Calendar" sheet,
// desktop browsers download the file and open it in Outlook / Calendar.
export async function GET(_request: Request, ctx: RouteContext<'/e/[id]/calendar.ics'>) {
  const { id } = await ctx.params;
  const event = ID_PATTERN.test(id) ? await getPublicEvent(id) : null;
  if (!event || event.archived) {
    return new Response('Event not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  return new Response(buildIcs(event), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${event.id}.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  });
}
