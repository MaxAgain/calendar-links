import { notFound, redirect } from 'next/navigation';
import { ID_PATTERN } from '@/lib/calendar';

// Links in the old format /e/?id=<id> keep working.
export default async function LegacyEventLink({ searchParams }: PageProps<'/e'>) {
  const params = await searchParams;
  const id = typeof params.id === 'string' ? params.id.trim().toLowerCase() : '';
  if (!ID_PATTERN.test(id)) notFound();
  const rest = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (k !== 'id' && typeof v === 'string' ? [[k, v]] : [])),
  );
  redirect(`/e/${id}${rest.size ? `?${rest}` : ''}`);
}
