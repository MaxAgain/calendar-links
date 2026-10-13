'use client';

import { useUser } from '@clerk/nextjs';
import { CheckIcon, CircleAlertIcon, ExternalLinkIcon, FileSpreadsheetIcon, RefreshCwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { connectSheetAction, disconnectSheetAction, syncSheetAction } from '@/app/(admin)/dashboard/actions';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { formatNumber } from '@/lib/format';
import type { SyncResult } from '@/lib/sync';
import { cn } from '@/lib/utils';

interface Props {
  config: {
    spreadsheetUrl: string;
    spreadsheetTitle: string;
    sheetName: string;
    connectedEmail: string;
    connectedAt: string;
    rowsSynced: number;
    lastSyncAt: string;
    lastError: string | null;
  } | null;
  access: { google: boolean; scope: boolean };
  sheetsScope: string;
  syncSchedule: string;
}

type Kind = 'ok' | 'warn' | 'error';
type Busy = 'sync' | 'connect' | 'disconnect';
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

const HOW_IT_WORKS = (
  <>
    Columns are matched by their header name (e.g. <span className="font-mono text-xs">event_id</span>), and missing columns are added
    after the last one. Only new clicks are added as new rows at the bottom; clicks that are already in the sheet are skipped. Existing
    cells are never changed.
  </>
);

/** Sheet link and tab name. The tab is created if the spreadsheet does not have it yet. */
function ConnectSheetForm({
  disabled,
  pending,
  defaultTab = 'Log',
  submitLabel,
  onConnect,
}: {
  disabled?: boolean;
  pending: boolean;
  defaultTab?: string;
  submitLabel: string;
  onConnect: (input: { url: string; tab: string }) => void;
}) {
  const id = useId();
  const [url, setUrl] = useState('');
  const [tab, setTab] = useState(defaultTab);

  function submit(e: FormEvent) {
    e.preventDefault();
    onConnect({ url, tab });
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-xl flex-col gap-4">
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor={`${id}-url`}>Sheet link</FieldLabel>
          <Input
            id={`${id}-url`}
            type="url"
            required
            disabled={disabled}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            spellCheck={false}
            autoComplete="off"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-tab`}>Tab</FieldLabel>
          <Input
            id={`${id}-tab`}
            required
            maxLength={100}
            disabled={disabled}
            spellCheck={false}
            autoComplete="off"
            aria-describedby={`${id}-tab-hint`}
            value={tab}
            onChange={(e) => setTab(e.target.value)}
            className="max-w-60"
          />
          <FieldDescription id={`${id}-tab-hint`}>One row per click goes into this tab. It is added if the sheet doesn’t have it.</FieldDescription>
        </Field>
      </FieldGroup>
      <Button type="submit" className="w-fit" disabled={disabled || pending || !url.trim()}>
        {pending ? 'Connecting …' : submitLabel}
      </Button>
    </form>
  );
}

export function SheetsCard({ config, access, sheetsScope, syncSchedule }: Props) {
  const { user } = useUser();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<Busy | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);

  const grantAccess = async () => {
    const google = user?.externalAccounts.find((a) => a.provider === 'google');
    if (!google) {
      toast.error('Your account is not linked to Google. Sign out and sign in with Google.');
      return;
    }
    try {
      const updated = await google.reauthorize({ additionalScopes: [sheetsScope], redirectUrl: window.location.href });
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

  const run = (which: Busy, action: () => Promise<ActionResult>, doneText = 'Done.', onSuccess?: () => void) => {
    setBusy(which);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
      else {
        if (result.sync) notify(describe(result.sync));
        else toast.success(doneText);
        onSuccess?.();
      }
      router.refresh();
      setBusy(null);
    });
  };

  const connect = (input: { url: string; tab: string }) =>
    run('connect', () => connectSheetAction(input), 'Sheet connected.', () => setSwitchOpen(false));

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
            <CardDescription>Copies every click into a Google Sheet you choose.</CardDescription>
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
              {config.spreadsheetTitle}
              <ExternalLinkIcon className="size-3.5" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>

            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Tab</dt>
              <dd className="min-w-0 break-words">{config.sheetName}</dd>
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
                    If {config.connectedEmail} left or revoked access, connect the sheet again with an account that can edit it. All data is kept in
                    the database, and clicks already in the sheet are not added twice.
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
                <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" disabled={pending}>
                      Connect a different sheet
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Connect a different sheet</DialogTitle>
                      <DialogDescription>{HOW_IT_WORKS}</DialogDescription>
                    </DialogHeader>
                    <ConnectSheetForm pending={pending && busy === 'connect'} defaultTab={config.sheetName} submitLabel="Connect sheet" onConnect={connect} />
                  </DialogContent>
                </Dialog>
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
              The dashboard needs permission to edit Google Sheets on your behalf. It only opens the sheet you connect below.
            </Step>
            <Step
              number={2}
              title="Connect your sheet"
              action={<ConnectSheetForm disabled={!access.scope} pending={pending && busy === 'connect'} submitLabel="Connect sheet" onConnect={connect} />}
            >
              Paste the link of a Google Sheet your account can edit. {HOW_IT_WORKS}
            </Step>
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
