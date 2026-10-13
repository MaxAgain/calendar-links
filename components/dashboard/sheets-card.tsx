'use client';

import { useUser } from '@clerk/nextjs';
import { CheckIcon, CircleAlertIcon, ExternalLinkIcon, FileSpreadsheetIcon, RefreshCwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { createSheetAction, disconnectSheetAction, syncSheetAction } from '@/app/(admin)/dashboard/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/format';
import type { SyncResult } from '@/lib/sync';
import { cn } from '@/lib/utils';

interface Props {
  config: {
    spreadsheetUrl: string;
    connectedEmail: string;
    connectedAt: string;
    rowsSynced: number;
    lastSyncAt: string;
    lastError: string | null;
  } | null;
  access: { google: boolean; scope: boolean };
  driveScope: string;
  syncSchedule: string;
}

type Kind = 'ok' | 'warn' | 'error';
type Busy = 'sync' | 'create' | 'disconnect';
type ActionResult = { ok: true; sync?: SyncResult } | { ok: false; error: string };

function describe(sync: SyncResult): { kind: Kind; text: string } {
  switch (sync.status) {
    case 'ok':
      return { kind: 'ok', text: sync.rows ? `Synced ${sync.rows} new row(s).` : 'Already up to date.' };
    case 'busy':
      return { kind: 'warn', text: 'A sync is already running. Try again in a moment.' };
    case 'not_connected':
      return { kind: 'warn', text: 'No sheet connected.' };
    case 'error':
      return { kind: 'error', text: sync.error };
  }
}

function notify({ kind, text }: { kind: Kind; text: string }) {
  if (kind === 'ok') toast.success(text);
  else if (kind === 'warn') toast.warning(text);
  else toast.error(text);
}

function Step({ number, done, title, action, children }: { number: number; done?: boolean; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
          done ? 'border-transparent bg-success/10 text-success' : 'bg-muted text-muted-foreground',
        )}
      >
        {done ? <CheckIcon className="size-4" /> : number}
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">
            {title}
            {done ? <span className="sr-only"> (done)</span> : null}
          </h3>
          <p className="text-sm text-muted-foreground">{children}</p>
        </div>
        {action}
      </div>
    </li>
  );
}

export function SheetsCard({ config, access, driveScope, syncSchedule }: Props) {
  const { user } = useUser();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<Busy | null>(null);

  const grantAccess = async () => {
    const google = user?.externalAccounts.find((a) => a.provider === 'google');
    if (!google) {
      toast.error('Your account is not linked to Google. Sign out and sign in with Google.');
      return;
    }
    try {
      const updated = await google.reauthorize({ additionalScopes: [driveScope], redirectUrl: window.location.href });
      const redirect = updated.verification?.externalVerificationRedirectURL;
      if (redirect) window.location.href = redirect.href;
      else router.refresh();
    } catch (err) {
      const text = (err as { errors?: { longMessage?: string; message?: string }[] }).errors?.[0];
      toast.error(
        `${text?.longMessage || text?.message || (err as Error).message} — Extra Google permissions need custom Google OAuth credentials in Clerk (see README → “Google Sheets”).`,
      );
    }
  };

  const run = (which: Busy, action: () => Promise<ActionResult>, doneText = 'Done.') => {
    setBusy(which);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
      else if (result.sync) notify(describe(result.sync));
      else toast.success(doneText);
      router.refresh();
      setBusy(null);
    });
  };

  const hasError = Boolean(config?.lastError);

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <FileSpreadsheetIcon className="size-5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <CardTitle>Google Sheets</CardTitle>
            <CardDescription>A copy of all clicks in a spreadsheet in your Google Drive.</CardDescription>
          </div>
        </div>
        <CardAction>
          {config ? (
            hasError ? (
              <Badge variant="destructive">Sync error</Badge>
            ) : (
              <Badge className="bg-success/10 text-success">Connected</Badge>
            )
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {config ? (
          <>
            <a
              className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-link underline-offset-4 hover:underline"
              href={config.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open sheet
              <ExternalLinkIcon className="size-3.5" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>

            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Connected by</dt>
              <dd className="min-w-0 break-words">{config.connectedEmail}</dd>
              <dt className="text-muted-foreground">Rows synced</dt>
              <dd className="tabular-nums">{formatNumber(config.rowsSynced)}</dd>
              <dt className="text-muted-foreground">Last sync</dt>
              <dd>{config.lastSyncAt}</dd>
              <dt className="text-muted-foreground">Automatic sync</dt>
              <dd>{syncSchedule}</dd>
            </dl>

            {config.lastError && (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertTitle>Last sync failed</AlertTitle>
                <AlertDescription>
                  <p>{config.lastError}</p>
                  <p>
                    If {config.connectedEmail} left or revoked access, create a new sheet below. All data is kept in the database and copied into the new
                    sheet.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" disabled={pending} onClick={() => run('sync', syncSheetAction)}>
                <RefreshCwIcon className={cn(pending && busy === 'sync' && 'animate-spin')} data-icon="inline-start" />
                {pending && busy === 'sync' ? 'Syncing …' : 'Sync now'}
              </Button>

              {access.scope ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" disabled={pending}>
                      {pending && busy === 'create' ? 'Creating …' : 'Create a new sheet'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Create a new sheet?</AlertDialogTitle>
                      <AlertDialogDescription>Create a new sheet in your Google Drive and sync all data into it?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => run('create', createSheetAction)}>Create sheet</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button type="button" variant="outline" onClick={grantAccess}>
                  Allow Google Sheets access
                </Button>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={pending}>
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Stop syncing?</AlertDialogTitle>
                    <AlertDialogDescription>Stop syncing? The sheet itself is not deleted.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => run('disconnect', disconnectSheetAction, 'Sheet disconnected.')}>
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        ) : (
          <ol className="flex flex-col gap-6">
            <Step
              number={1}
              done={access.scope}
              title="Allow Google Sheets access"
              action={
                access.scope ? null : (
                  <Button type="button" onClick={grantAccess}>
                    Allow Google Sheets access
                  </Button>
                )
              }
            >
              The dashboard creates a tracking sheet in your Google Drive. Google will ask you to allow access to{' '}
              <strong className="font-medium text-foreground">files created by this app only</strong>, not to your other files.
            </Step>
            <Step
              number={2}
              title="Create the tracking sheet"
              action={
                <Button type="button" disabled={pending || !access.scope} onClick={() => run('create', createSheetAction)}>
                  {pending && busy === 'create' ? 'Creating …' : 'Create tracking sheet'}
                </Button>
              }
            >
              Creates “Solakon Calendar Links – Tracking” in your Google Drive with a{' '}
              <strong className="font-medium text-foreground">Log</strong> tab (one row per click) and a{' '}
              <strong className="font-medium text-foreground">Summary</strong> tab (totals per event, calendar, device and day), then copies all clicks so far.
            </Step>
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
