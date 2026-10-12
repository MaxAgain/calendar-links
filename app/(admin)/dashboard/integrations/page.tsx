import { SheetPanel } from '@/components/admin/SheetPanel';
import { requireStaffPage } from '@/lib/auth';
import { getSetting } from '@/lib/events';
import { formatDateTime } from '@/lib/format';
import { DRIVE_FILE_SCOPE, hasSheetsAccess } from '@/lib/sheets';
import { SHEET_SETTING, type SheetConfig } from '@/lib/sync';

export default async function IntegrationsPage() {
  const user = await requireStaffPage();
  const [config, access] = await Promise.all([getSetting<SheetConfig>(SHEET_SETTING), hasSheetsAccess(user.id)]);

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">Google Sheet</h1>
      <p className="mb-5 max-w-3xl text-sm text-sk-gray-600">
        All clicks are stored in the database. The Google Sheet is a copy for analysis and sharing — anonymous data only (no emails, no IP addresses).
      </p>
      <SheetPanel
        config={
          config
            ? {
                spreadsheetUrl: config.spreadsheetUrl,
                connectedEmail: config.connectedEmail,
                connectedAt: config.connectedAt,
                rowsSynced: config.rowsSynced,
                lastSyncAt: formatDateTime(config.lastSyncAt),
                lastError: config.lastError,
              }
            : null
        }
        access={access}
        driveScope={DRIVE_FILE_SCOPE}
        syncSchedule={process.env.SHEET_SYNC_SCHEDULE_LABEL || 'Once a day (every 15 minutes on Vercel Pro) — use “Sync now” any time'}
      />
    </>
  );
}
