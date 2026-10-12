# Solakon Calendar Links

One link per event for Klaviyo emails. The link opens a page that detects the recipient's device and offers the right calendar button (Apple, Google, Outlook, Yahoo, Microsoft 365 or a plain `.ics` file). Staff create and manage events in a dashboard. Each page view and calendar click is tracked anonymously, and the data is copied into a Google Sheet.

Stack: Next.js 16.4 (App Router), React 19.3, TypeScript, Tailwind CSS v4 (dashboard only), Clerk (Google sign-in, dashboard only), Drizzle ORM with `pg` on Neon Postgres, Vercel (functions in `fra1`), Vitest.

## How it works

- **Recipient page** `/e/<id>`: shows the event and the calendar buttons. The main button depends on the device. Apple Calendar and Outlook desktop use the `.ics` file.
- **Calendar file** `/e/<id>/calendar.ics`: serves the iCalendar file.
- **Legacy links** `/e?id=<id>` redirect to `/e/<id>`.
- **Dashboard** `/dashboard`: create, edit, duplicate, archive and share events, and manage the Google Sheet integration.
- **Tracking**: each view and click is stored in Postgres. A cron job copies new rows into the Google Sheet.

## Daily use

1. Sign in at the dashboard with your solakon.de Google account.
2. Click **New event**, or duplicate an existing event for a similar one.
3. Fill in the details. The live preview shows the recipient page.
4. Click **Save**.
5. Open the **Share** page and copy the link.
6. Paste the link into a **Button** block in the Klaviyo email (e.g. "Zum Kalender hinzufügen"). Klaviyo's UTM parameters are fine, but never put profile merge tags (email, name, profile ID) into UTM values; UTM values containing `@` are discarded.
7. Send yourself a test email and click the button on your phone.

Rules to know:

- **Link IDs never change.** Links in sent emails must keep working.
- **Editing** an event keeps the same link and calendar UID, and the sequence number goes up. Edits do **not** reach calendars automatically: an `.ics` import is a one-time copy. If someone adds the event again after an edit, Apple Calendar and Outlook desktop replace the old entry instead of adding a duplicate. Google, Outlook.com and Yahoo links always create a new entry.
- **Archive** hides an event. **Events are never deleted.**

## Architecture

```
app/
  (public)/        recipient pages, plain CSS (old in-app browsers)
    e/             /e/[id], /e/[id]/calendar.ics, legacy /e?id=
    preview/       preview page (framed by the dashboard)
  (admin)/         dashboard, Tailwind with the Solakon theme
    dashboard/     events, integrations, server actions
    sign-in/, sign-up/, no-access/
  api/
    track/         anonymous tracking beacon
    cron/sync-sheets/   scheduled Sheet sync
components/
  landing/         recipient page UI and tracker
  admin/           dashboard UI (SheetPanel, EventEditor, ...)
lib/
  auth.ts          staff access check (Clerk + email domain)
  calendar.ts      .ics builder and calendar links
  platform.ts      device detection and recommended calendar
  events.ts        event reads/writes, cache
  tracking.ts      validation of tracking payloads
  sync.ts          Postgres to Sheet sync
  sheets.ts        Google Sheets and Drive API calls
  sheet-layout.ts  Sheet tabs, columns, formulas
  site.ts          public settings, site URL, UID domain
  db/              Drizzle client and schema
proxy.ts           Clerk, dashboard routes only
drizzle/           migrations (generated, committed)
tests/             Vitest tests
```

## Privacy

- **Clerk runs only on admin routes.** `proxy.ts` matches `/`, `/dashboard/*`, `/sign-in/*`, `/sign-up/*`, `/no-access` and Clerk's proxy path `/__clerk/*`. Recipient pages, `/api/track` and the cron job get no Clerk scripts, cookies or redirects.
- **Tracking is anonymous.** No cookies or localStorage, no IP addresses, no raw user agent. Only coarse values are stored (OS, browser, device type, in-app browser, language, time zone, UTM parameters, app version). The page-session ID exists only in memory during the visit.
- **Actions tracked:** `view`, `add` (calendar button clicked) and `not_found` (broken or mistyped link).
- **No consent banner is needed** under TDDDG §25 for this setup, because nothing is stored on the recipient's device. As a result, returning visitors can't be counted.
- Name the processors in the privacy policy: Vercel (hosting), Neon (database), Google (Sheets/Drive) and Clerk (staff sign-in only).

## Local development

Requirements: Node.js 22 or newer (CI uses 24), npm, access to the Vercel project.

```bash
npm ci
npx vercel@latest link      # only if the folder is not linked yet
npm run env:pull            # writes .env.local from Vercel (never commit it)
npm run db:migrate          # apply migrations to the development database
npm run dev                 # http://localhost:3000
```

Scripts:

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm run start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types, then TypeScript check (`next typegen && tsc --noEmit`) |
| `npm test` | Vitest |
| `npm run env:pull` | Pull environment variables from Vercel into `.env.local` |
| `npm run db:generate` | Generate a migration from `lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations (uses the unpooled connection) |
| `npm run db:studio` | Drizzle Studio for browsing the database |

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon connection string (pooled) for the app |
| `DATABASE_URL_UNPOOLED` | for migrations | Direct Neon connection for `drizzle-kit`. Falls back to `DATABASE_URL` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | yes | Clerk secret key (server only) |
| `CRON_SECRET` | yes | Bearer token that Vercel Cron sends to `/api/cron/sync-sheets`. Requests without it get 401 |
| `ALLOWED_EMAIL_DOMAINS` | no | Comma-separated email domains allowed in the dashboard. Default `solakon.de` |
| `NEXT_PUBLIC_SITE_URL` | no | Public base URL used in links (e.g. `https://cal.solakon.de`). Falls back to `VERCEL_PROJECT_PRODUCTION_URL`, then `http://localhost:3000` |
| `VERCEL_PROJECT_PRODUCTION_URL` | set by Vercel | Production hostname, used when `NEXT_PUBLIC_SITE_URL` is not set |
| `SHEET_SYNC_SCHEDULE_LABEL` | no | Display text for the sync schedule on the Integrations page. Display only |

Never put secret values in the repository, in issues or in the README. Keep them in Vercel and pull them with `npm run env:pull`.

## Database and migrations

Tables: `events`, `clicks` (tracking rows), `settings` (key/value, holds the Sheet connection).

Schema changes:

```bash
# 1. edit lib/db/schema.ts
npm run db:generate         # creates a new file in drizzle/
git add drizzle && git commit -m "Describe the schema change"
npm run db:migrate          # apply to the database
```

Commit the generated `drizzle/` files. Do not edit generated migrations by hand.

## Google Sheets integration

Postgres is the source of truth. The Sheet is a copy that can be recreated at any time.

- **Connect** on the Integrations page (`/dashboard/integrations`) creates "Solakon Calendar Links – Tracking" in the connecting user's Google Drive. It has a **Log** tab (one row per click) and a **Summary** tab.
- The app uses only the scope `https://www.googleapis.com/auth/drive.file`, so it can see only files it creates. It reads the Google token that Clerk holds for the signed-in user.
- Rows are appended with RAW input, so values are never interpreted as formulas. The Sheet uses locale `en_GB` and time zone `Europe/Berlin`.
- **Syncs never overlap.** A row lock on the connection setting makes a second sync return "busy". Progress is committed after every batch, so a sync that is cut off resumes where it stopped.
- Clicks younger than one minute are left for the next sync, so a test click won't show up in the Sheet immediately.
- **Automatic sync:** `/api/cron/sync-sheets` runs once a day (`0 5 * * *`, 05:00 UTC, the Vercel Hobby limit). After upgrading to Vercel Pro, change the schedule in `vercel.json` to `*/15 * * * *`. **Sync now** works at any time.
- If the connected person leaves or revokes access, the sync shows an error. Use **Create a new sheet**. All data is still in the database and is copied into the new sheet.

### Setup: Google OAuth client for extra scopes

Clerk's shared development Google credentials cannot request extra scopes. The Connect button only works (in development too) once you set up your own OAuth client:

1. In Google Cloud Console, create an OAuth client (type "Web application"). Use user type **Internal** if solakon.de uses Google Workspace.
2. In Clerk, go to **SSO connections → Google** and paste the client ID and client secret.
3. In Clerk's Google settings, add the scope `https://www.googleapis.com/auth/drive.file`.
4. Add the redirect URI shown in Clerk's Google settings to the Google OAuth client.
5. Test: sign in, open Integrations, click **Allow Google Sheets access**, then **Create tracking sheet**.

## Deployment and production checklist

The app is hosted on Vercel (project `calendar-links`). Functions run in `fra1` (see `vercel.json`). Until the Vercel GitHub app is connected to the repository, deploy from the CLI:

```bash
npx vercel@latest deploy           # preview
npx vercel@latest deploy --prod    # production
```

Open items before go-live:

- [ ] **Upgrade to Vercel Pro.** The Hobby plan is for non-commercial use only. Pro also allows the 15-minute Sheet sync (see above).
- [ ] **Add a custom domain**, e.g. `cal.solakon.de`. Links in emails need a stable domain. Clerk production keys do not work on `*.vercel.app`.
- [ ] **Create a Clerk production instance** and set its keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) in Vercel.
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the production domain.
- [ ] Set up the Google OAuth client (see above).
- [ ] Run `npm run db:migrate` against the production database.
- [ ] Connect the Vercel GitHub app to the repository so pushes deploy automatically.
- [ ] Send a test email through Klaviyo, click the button on iPhone, Android and a desktop, and check that the event appears in the Sheet.
- [ ] Turn off the v1 GitHub Pages site once no live email links point to it.

## Contributing rules

- **Colors:** use only the Solakon palette (`sk-yellow`, `sk-blue`, `sk-gray`). Primary buttons are yellow with dark text.
- **Status colors:** Tailwind green, amber and red.
- **Icons:** monochrome. No third-party logos.
- **Language:** recipient copy in German always uses the formal "Sie", never "du". The dashboard UI is in English.
- **Route groups:** `(public)` uses plain CSS, because old in-app browsers do not handle modern CSS well. `(admin)` uses Tailwind.
- **Clerk** must stay limited to admin routes (see `proxy.ts`). Do not add Clerk to recipient pages.
- **UIDs:** do not change the UID domain (`cal.solakon.de`) after the first event is published.
- **Before opening a PR:** `npm run typecheck`, `npm run lint` and `npm test` must pass. CI runs the same checks.
