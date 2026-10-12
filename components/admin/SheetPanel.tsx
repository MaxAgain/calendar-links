'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createSheetAction, disconnectSheetAction, syncSheetAction } from '@/app/(admin)/dashboard/actions';
import type { SyncResult } from '@/lib/sync';

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

function describe(sync: SyncResult): { kind: 'ok' | 'warn' | 'error'; text: string } {
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

export function SheetPanel({ config, access, driveScope, syncSchedule }: Props) {
  const { user } = useUser();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  const grantAccess = async () => {
    setNotice(null);
    const google = user?.externalAccounts.find((a) => a.provider === 'google');
    if (!google) {
      setNotice({ kind: 'error', text: 'Your account is not linked to Google. Sign out and sign in with Google.' });
      return;
    }
    try {
      const updated = await google.reauthorize({ additionalScopes: [driveScope], redirectUrl: window.location.href });
      const redirect = updated.verification?.externalVerificationRedirectURL;
      if (redirect) window.location.href = redirect.href;
      else router.refresh();
    } catch (err) {
      const text = (err as { errors?: { longMessage?: string; message?: string }[] }).errors?.[0];
      setNotice({
        kind: 'error',
        text: `${text?.longMessage || text?.message || (err as Error).message} — Extra Google permissions need custom Google OAuth credentials in Clerk (see README → “Google Sheets”).`,
      });
    }
  };

  const run = (action: () => Promise<{ ok: true; sync?: SyncResult } | { ok: false; error: string }>) =>
    startTransition(async () => {
      setNotice(null);
      const result = await action();
      if (!result.ok) setNotice({ kind: 'error', text: result.error });
      else if (result.sync) setNotice(describe(result.sync));
      else setNotice({ kind: 'ok', text: 'Done.' });
      router.refresh();
    });

  return (
    <div className="panel max-w-3xl">
      {notice && <div className={`msg msg-${notice.kind}`} role="status">{notice.text}</div>}

      {config ? (
        <>
          <p className="mb-1 text-sm text-sk-gray-600">Connected sheet</p>
          <p className="mb-4">
            <a className="font-semibold text-sk-blue-600" href={config.spreadsheetUrl} target="_blank" rel="noopener noreferrer">Open “Solakon Calendar Links – Tracking” ↗</a>
          </p>
          <dl className="mb-4 grid grid-cols-[160px_1fr] gap-y-1 text-sm">
            <dt className="text-sk-gray-600">Connected by</dt><dd>{config.connectedEmail}</dd>
            <dt className="text-sk-gray-600">Rows synced</dt><dd>{config.rowsSynced}</dd>
            <dt className="text-sk-gray-600">Last sync</dt><dd>{config.lastSyncAt}</dd>
            <dt className="text-sk-gray-600">Automatic sync</dt><dd>{syncSchedule}</dd>
          </dl>
          {config.lastError && (
            <div className="msg msg-error" role="alert">
              Last sync failed: {config.lastError}
              <br />
              If {config.connectedEmail} left or revoked access, create a new sheet below — all data is kept in the database and copied into the new sheet.
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" type="button" disabled={pending} onClick={() => run(syncSheetAction)}>{pending ? 'Working …' : 'Sync now'}</button>
            {access.scope ? (
              <button className="btn" type="button" disabled={pending} onClick={() => window.confirm('Create a new sheet in your Google Drive and sync all data into it?') && run(createSheetAction)}>Create a new sheet</button>
            ) : (
              <button className="btn" type="button" onClick={grantAccess}>Allow Google Sheets access</button>
            )}
            <button className="btn btn-link" type="button" disabled={pending} onClick={() => window.confirm('Stop syncing? The sheet itself is not deleted.') && run(disconnectSheetAction)}>Disconnect</button>
          </div>
        </>
      ) : !access.scope ? (
        <>
          <h2 className="mb-2 text-lg font-bold">Step 1: Allow Google Sheets access</h2>
          <p className="mb-4 text-sm">
            The dashboard creates a tracking sheet in your Google Drive. Google will ask you to allow access to <strong>files created by this app only</strong> — not to your other files.
          </p>
          <button className="btn btn-primary" type="button" onClick={grantAccess}>Allow Google Sheets access</button>
        </>
      ) : (
        <>
          <h2 className="mb-2 text-lg font-bold">Step 2: Create the tracking sheet</h2>
          <p className="mb-4 text-sm">
            Creates “Solakon Calendar Links – Tracking” in your Google Drive with a <strong>Log</strong> tab (one row per click) and a <strong>Summary</strong> tab (totals per event, calendar, device and day), then copies all clicks so far.
          </p>
          <button className="btn btn-primary" type="button" disabled={pending} onClick={() => run(createSheetAction)}>{pending ? 'Creating …' : 'Create tracking sheet'}</button>
        </>
      )}
    </div>
  );
}
