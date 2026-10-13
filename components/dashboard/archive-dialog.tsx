'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { setArchivedAction } from '@/app/(admin)/dashboard/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function ArchiveDialog({
  event,
  open,
  onOpenChange,
}: {
  event: { id: string; title: string; archived: boolean };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const restoring = event.archived;

  function confirm() {
    startTransition(async () => {
      const result = await setArchivedAction(event.id, !event.archived);
      if (result.ok) {
        toast.success(restoring ? 'Event restored' : 'Event archived', { description: event.title });
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      {/* Restore has no description; opting out of aria-describedby avoids Radix's missing-description warning. */}
      <AlertDialogContent {...(restoring ? { 'aria-describedby': undefined } : {})}>
        <AlertDialogHeader>
          <AlertDialogTitle>{restoring ? `Restore "${event.title}"?` : `Archive "${event.title}"?`}</AlertDialogTitle>
          {restoring ? null : (
            <AlertDialogDescription>
              Anyone who opens the link will see “event not available”. You can restore it at any time.
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={restoring ? 'default' : 'destructive'}
            disabled={pending}
            onClick={(e) => {
              // Keep the dialog open until the action has finished, so the result is visible.
              e.preventDefault();
              confirm();
            }}
          >
            {pending ? (restoring ? 'Restoring…' : 'Archiving…') : restoring ? 'Restore' : 'Archive'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
