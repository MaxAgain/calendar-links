'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setArchivedAction } from '@/app/(admin)/dashboard/actions';

export function ArchiveButton({ id, title, archived }: { id: string; title: string; archived: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-sm btn-link"
      disabled={pending}
      onClick={() => {
        if (!archived && !window.confirm(`Archive "${title}"?\n\nAnyone who clicks the link will see "event not available". You can restore it at any time.`)) return;
        startTransition(async () => {
          const result = await setArchivedAction(id, !archived);
          if (!result.ok) window.alert(result.error);
          router.refresh();
        });
      }}
    >
      {pending ? '…' : archived ? 'Restore' : 'Archive'}
    </button>
  );
}
