'use client';

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CopyIcon,
  CopyPlusIcon,
  EyeIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  PencilIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { ArchiveDialog } from '@/components/dashboard/archive-dialog';
import { copyToClipboard } from '@/components/dashboard/copy-button';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { eventPath } from '@/lib/site';

// Menus and dialogs render in portals, but React events still bubble to the parent tree. Stop them here so the
// menu works inside clickable table rows (a click or Enter on an item must not also open the row).
const stopClick = (e: MouseEvent) => e.stopPropagation();
const stopActivationKeys = (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
};

export function EventActionsMenu({
  event,
  link,
  align = 'end',
  trigger,
}: {
  event: { id: string; title: string; archived: boolean };
  /** Full recipient URL, built on the server (it depends on the site URL setting). */
  link: string;
  align?: 'start' | 'center' | 'end';
  /** Replaces the default "⋯" button. Must be a single element that accepts a ref and click handlers (e.g. a Button). */
  trigger?: ReactNode;
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const base = `/dashboard/events/${event.id}`;

  return (
    <span className="contents" onClick={stopClick} onKeyDown={stopActivationKeys}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger ?? (
            <Button variant="ghost" size="icon" aria-label={`Actions for ${event.title}`}>
              <MoreHorizontalIcon />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-52">
          <DropdownMenuItem asChild>
            <Link href={base}>
              <EyeIcon />
              View details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`${base}/edit`}>
              <PencilIcon />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/events/new?from=${encodeURIComponent(event.id)}`}>
              <CopyPlusIcon />
              Duplicate
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void copyToClipboard(link)}>
            <CopyIcon />
            Copy link
          </DropdownMenuItem>
          {/* A plain anchor: recipient pages must be reached by a full page load, never client-side navigation. */}
          <DropdownMenuItem asChild>
            <a href={eventPath(event.id)} target="_blank" rel="noopener">
              <ExternalLinkIcon />
              Open recipient page
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {event.archived ? (
            <DropdownMenuItem onSelect={() => setArchiveOpen(true)}>
              <ArchiveRestoreIcon />
              Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem variant="destructive" onSelect={() => setArchiveOpen(true)}>
              <ArchiveIcon />
              Archive
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ArchiveDialog event={event} open={archiveOpen} onOpenChange={setArchiveOpen} />
    </span>
  );
}
