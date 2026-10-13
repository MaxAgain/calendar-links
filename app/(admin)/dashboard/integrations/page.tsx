import { PageHeader } from '@/components/dashboard/page-header';
import { SheetsCard } from '@/components/dashboard/sheets-card';
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
      <PageHeader
        title="Integrations"
        description="All clicks are stored in the database. The Google Sheet is a copy for analysis and sharing, with anonymous data only (no emails, no IP addresses)."
      />
      <SheetsCard
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
        syncSchedule={process.env.SHEET_SYNC_SCHEDULE_LABEL || 'Once a day (every 15 minutes on Vercel Pro). Use “Sync now” at any time.'}
      />
    </>
  );
}
