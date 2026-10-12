# Solakon Calendar Links

One link per event for Klaviyo emails. When a recipient clicks it, a small Solakon-branded page opens. The page shows the event and offers the right calendar for the recipient's device, plus all the others:

| Device | Main button |
|---|---|
| iPhone / iPad / Mac | Apple Calendar (`.ics` file) |
| Android | Google Calendar |
| Windows | Outlook desktop (`.ics` file) |
| Everything else | Google Calendar |

The other buttons are Google, Outlook.com, Microsoft 365, Yahoo, and a plain `.ics` download.

**How it works**

- **Hosting.** Everything is static files on GitHub Pages. There's no server and no build step.
- **Dashboard (`/admin/`).** Events are created here and saved into this repository.
- **Tracking.** Opens and calendar choices are logged anonymously to a Google Sheet through a small Google Apps Script.

```
Dashboard (/admin/) ──GitHub API──▶ events/<id>.json + <id>.ics ──GitHub Pages──▶ /e/?id=<id>
                                                                                   │ anonymous beacon
Google Sheet (Log + Summary) ◀── Apps Script web app ◀─────────────────────────────┘
```

---

## Daily use

1. Open the dashboard, e.g. `https://cal.solakon.de/admin/`.
2. Click **+ New event**. Fill in the title, description, date and time, and optionally a location, online link and reminder.
3. Check the **live preview** on the right. Switch the device to see what iPhone, Android or Windows users get. The preview buttons work, so you can test the calendar entries.
4. Click **Publish**. After about a minute the status changes to **Live ✓**.
5. Click **Copy link** and paste it into a **Button** block in Klaviyo (e.g. "Zum Kalender hinzufügen").
6. Send yourself a test email and click the button on your phone.

**Good to know**

- **Editing** an event keeps the same link. People who already added it get an update when they add it again, rather than a duplicate. Changes can take up to ~10 minutes to reach everyone because of caching.
- **The link ID can't change after publishing.** Links in sent emails would break.
- **Archive** hides an event from the list and makes its link show "event not available". **Restore** undoes this. Events are never deleted.
- **Duplicate** is the quickest way to create a recurring or similar event.
- **Stats** (views, adds, add rate, which calendar people chose) appear in the event list once tracking is connected.
- **Klaviyo UTM tracking.** If you turn it on (Klaviyo → Settings → UTM Tracking), the campaign name shows up in the Google Sheet automatically.

---

## One-time setup

### 1. GitHub repository and Pages

1. Create a repository, e.g. `solakon/calendar`.
   - On the free GitHub plan, Pages requires a **public** repository. That's fine: the event data is public anyway, since it sits behind links in emails.
2. Push this folder to the `main` branch.
3. In the repository, go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, and select `main` / `/ (root)`. Save.
4. After about a minute the site is live at `https://<owner>.github.io/<repo>/`.
5. Test it by opening `https://<owner>.github.io/<repo>/e/?id=beispiel-webinar`.

### 2. Custom domain (strongly recommended)

Links in sent emails stay in inboxes forever. With your own domain they keep working even if the hosting ever changes, and they look trustworthy in emails.

1. At the DNS provider, add a `CNAME` record for `cal.solakon.de` pointing to `<owner>.github.io`.
2. In the repository, go to **Settings → Pages → Custom domain**, enter `cal.solakon.de` and save. GitHub commits a `CNAME` file.
3. Tick **Enforce HTTPS** once it becomes available (this can take up to an hour).
4. In the dashboard settings, set **Public site URL** to `https://cal.solakon.de/`.

### 3. GitHub token (for the dashboard)

Each person who publishes events needs their own token.

1. Go to GitHub → profile picture → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Fill in the token form:
   - **Resource owner:** the account or organization that owns the repository
   - **Expiration:** up to 1 year. Put a reminder in your calendar to renew it.
   - **Repository access:** Only select repositories → this repository
   - **Permissions → Repository permissions → Contents:** Read and write
3. Copy the token (`github_pat_…`).
4. Open `/admin/` → **Settings** and enter the owner, repository, branch (`main`) and token. Click **Test connection**, then **Save**.

The token is stored only in that browser on that computer. It's never published. If it expires, the dashboard tells you, and you create a new one the same way.

### 4. Google Sheet tracking

1. Create a new Google Sheet, e.g. "Calendar link tracking".
2. Go to **Extensions → Apps Script**. Delete the sample code, paste the contents of [`apps-script/Code.gs`](apps-script/Code.gs), and save.
3. Select the function **`setup`** in the toolbar and click **Run**. Allow access when asked.
   - The **execution log** shows a `STATS_KEY`. Copy it.
   - The Sheet now has a **Log** tab (one row per click) and a **Summary** tab (totals per event, per calendar, per OS, per day).
4. Go to **Deploy → New deployment → ⚙ → Web app**:
   - **Execute as:** Me
   - **Who has access:** Anyone. The page is opened by anonymous email recipients.
   - Click **Deploy** and copy the **Web app URL**. It must end in `/exec`.
5. In the dashboard **Settings**:
   - Paste the web app URL and the stats key.
   - Click **Test connection**, then **Save**.
   - Click **Activate tracking on the site** in the yellow banner. This writes the URL into `assets/config.js`.

**If "Anyone" isn't offered:** your Google Workspace admin blocks public web apps. Either ask the admin to allow them, or create the Sheet with a different Google account.

**After changing `Code.gs`:** go to **Deploy → Manage deployments → ✎ Edit → Version: New version → Deploy**. This keeps the same URL. A "New deployment" would create a new URL.

---

## What is tracked (and what isn't)

Each row in the **Log** tab contains:

- **Time and event:** timestamp, event ID
- **Action:**
  - `view`: page opened
  - `add`: calendar button clicked
  - `not_found`: someone clicked a broken or mistyped link
- **Calendar choice:** which calendar was chosen, and whether it was the recommended one
- **Device:** coarse OS, browser and device type, plus the in-app browser (Gmail, Instagram, …) if any
- **Locale:** browser language and time zone
- **Campaign:** UTM parameters
- **Session:** a random page-session ID that links a view to its click. It's only kept in memory during the visit.
- **Version:** the app version

**Not tracked:**

- No IP addresses (the Apps Script never sees them)
- No raw user agent
- No email addresses or Klaviyo IDs
- No cookies or localStorage on the recipient page

So no consent banner is needed under TDDDG §25. As a result, "has this person visited before" can't be measured. Mention Google (Sheets/Apps Script) as a processor in the privacy policy as usual.

---

## Reliability notes

- **Apple Calendar and Outlook desktop use a hosted `.ics` file.** GitHub Pages serves it as `text/calendar`. This is the most reliable way to trigger "Add to Calendar" on iPhone and Mac.
- **Times are stored in UTC** and shown in the recipient's local time zone. A note appears when that differs from the event's time zone.
- **iPhone in-app browsers** (Gmail app, Instagram, Chrome on iOS) can't hand `.ics` files to Apple Calendar. The page detects this and shows "open in Safari" with a copy-link button. Google and Outlook buttons still work there.
- **Tracking never blocks** the calendar action. If the Apps Script is down, adding to the calendar still works.
- **Links written as `/e/<id>`** instead of `/e/?id=<id>` are redirected automatically.
- **Publishing is one atomic commit.** If two people publish at the same moment, the second publish rebuilds on top of the first automatically.
- **The Outlook.com and Microsoft 365 web links use an undocumented Microsoft URL format.** It's widely used, but re-test it occasionally (see the checklist below).

---

## Fallback: publish without the dashboard

```bash
# event.json → see scripts/sample-event.json for the format
node scripts/build-event.mjs event.json
git add events && git commit -m "Add event" && git push
```

---

## Development

```bash
npm test          # .ics format, time zones/DST, URLs, device detection, formal German, Apps Script, GitHub publishing
npm run serve     # http://localhost:8000/e/?id=beispiel-webinar and http://localhost:8000/admin/
```

**Project files**

| Path | Purpose |
|---|---|
| `e/index.html`, `assets/js/landing.js` | Recipient page |
| `admin/index.html`, `assets/js/admin.js` | Dashboard |
| `assets/js/calendar.js` | `.ics` builder, Google/Outlook/Yahoo links, time-zone conversion (shared) |
| `assets/js/platform.js` | Device detection → recommended calendar |
| `assets/js/i18n.js` | German/English texts on the recipient page (German always uses the formal "Sie") |
| `assets/css/tokens.css` | Solakon brand colors. The only place colors are defined |
| `assets/config.js` | Public settings: brand URL, tracking URL, UID domain |
| `events/` | Published events (`<id>.json`, `<id>.ics`, `index.json`) |
| `apps-script/Code.gs` | Google Sheet tracking endpoint |

**Logo:** replace the `SOLAKON` text in the header of `e/index.html` with `<img src="../assets/img/logo-white.svg" alt="Solakon">` once the white SVG logo is added.

**Do not change** `uidDomain` in `assets/config.js` after the first event is published. It's part of every event's identity in people's calendars. Existing events keep their stored UID regardless.

### Device test checklist (run once after setup, and after bigger changes)

For each device, check:

- the recommended button is right
- the event lands with the correct time
- umlauts are intact
- the reminder is set

| Device | Setups to test |
|---|---|
| iPhone | Safari, Gmail app (expect the "open in Safari" hint), Chrome |
| Android | Chrome, Gmail app |
| Mac | Safari, Chrome |
| Windows | Edge or Chrome with classic Outlook / new Outlook |
| Web calendars | Outlook.com and Microsoft 365 while logged in |
| Klaviyo | Test send → click → a row appears in the Sheet with `utm_campaign` |
