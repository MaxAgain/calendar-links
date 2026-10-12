import { syncSheet } from '@/lib/sync';

// Called by Vercel Cron (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await syncSheet();
  return Response.json(result, { status: result.status === 'error' ? 500 : 200 });
}
