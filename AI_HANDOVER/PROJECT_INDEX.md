# Prime Auto Care — Project Index and Developer Handover

_Last verified: 20 November 2026 (Asia/Kolkata)_

This file is a navigation and continuity guide for a developer or another AI assistant. The repository source code is authoritative. Always inspect the current `main` branch and live service state before changing production.

## 1. Current public URLs

- Business website: https://prime-auto-care-sigma.vercel.app/
- Customer booking page: https://prime-auto-care-sigma.vercel.app/booking/
- GitHub repository: https://github.com/zaid404sec/zaid404sec
- Application source folder: https://github.com/zaid404sec/zaid404sec/tree/main/car-wash-erp
- AI handover folder: https://github.com/zaid404sec/zaid404sec/tree/main/AI_HANDOVER

The two Vercel routes were fetched and verified as HTTP 200 with `Content-Type: text/html; charset=utf-8`. Do not use the old GitHub Pages links as the official customer links.

### Hosting architecture

- Vercel project name: `prime-auto-care`
- Vercel project ID: `prj_TDEAylEd55OPJKN7oXgI7IoEFNAP`
- Public Vercel alias: `prime-auto-care-mz03200786-2785s-projects.vercel.app`
- Website source: `car-wash-erp/website/index.html`
- Booking page source: `car-wash-erp/website/booking/index.html`
- The Vercel production deployment was uploaded as static files. GitHub automatic deployment is **not yet linked**: the Vercel Git linking attempt reported that a GitHub Login Connection must first be added. To enable automatic deployment, connect the GitHub account to Vercel and link this repository/project. Until then, a website source change must be followed by a Vercel deployment.
- Supabase Edge Functions rewrite HTML responses as `text/plain` in this project. The static HTML is therefore hosted on Vercel; Supabase remains the database/API backend.
- Legacy Supabase routes redirect to the new URLs:
  - `prime-auto-care-site` v5 → Vercel business website (and its booking subroute).
  - `prime-auto-care-booking` v4 → Vercel booking page.
  - `prime-auto-care-website` v4 → Vercel business website.
- The business site calls the public review feed at `/functions/v1/public-reviews`; that function's CORS allowlist includes the Vercel alias.

## 2. Current application and backend state

- Product/application name: Prime Auto Care / WashDesk.
- Application version in `car-wash-erp/package.json`: **2.15.0**.
- Android application ID: `com.washdesk.carwash.v33`.
- Supabase project ref: `jkjudmkqaebrgllemris`.
- Supabase project status: `ACTIVE_HEALTHY`.
- Supabase project region: `ap-northeast-2`.
- Production booking API: `booking-api` v13.
- Public review feed: `public-reviews` v5.
- Legacy website redirects: `prime-auto-care-site` v4, `prime-auto-care-booking` v3, `prime-auto-care-website` v3.
- Other deployed Google Review functions include `google-review-api`, `google-review-oauth-callback`, `google-review-worker` and `google-review-pubsub-webhook`. Re-check their live versions before future work.

### Booking API v23 and device notification changes

- CORS accepts the Vercel public website origin.
- The list response includes `permissions.notifications_enabled` and `permissions.notification_device_count`.
- Workspace members are automatically enrolled for booking alerts by database trigger; a second 8-digit notification pairing code is no longer part of the standard app flow.
- The old one-time 8-digit notification-code API actions and tables remain for backwards compatibility but are no longer exposed in the normal Bookings UI.
- Public booking actions are `public-config`, `availability` and `create-public`.
- Authenticated workspace actions include listing/managing bookings, status changes, per-device notification reads and Owner-only revocation of notification access.

## 3. Workspace ownership, device enrolment and sign-in model

**Current Owner sign-in:** the Prime Auto Care mobile/desktop Owner application uses the registered Supabase email/password login `primeautoconsult@gmail.com`. The production workspace role is `owner`. Booking-only staff devices continue to use separate member identities and PAC booking access; they do not receive business-record access.

- The database does not contain an email address for anonymous phone identities. A GitHub or Vercel account email does not automatically become the WashDesk Workspace Owner.
- The current registered Owner Auth identity is `primeautoconsult@gmail.com` (`970c1195-a7a2-4984-9293-aefccc105c05`) with the `owner` workspace role. The previous Owner login accounts remain as Members; do not delete them. The canonical business data-owner key remains `e836efd7-48cc-4c5f-87e9-78a1b87297e3` and must not be changed without a verified migration.
- Older anonymous identities have been retained as workspace Members. The notification redesign did not delete identities, reset the workspace, or alter customer, invoice, booking, inventory or billing records.
- The existing private 64-character workspace pairing credential is the one-time-in-practice join credential for a new device. Connect each phone/laptop once through Settings → Business Settings → Connect / Pair this device. Do not publish, commit or put the code into a handover file.
- **There is no separate 8-digit booking-notification code in the normal UI.** Any authenticated workspace member is automatically enrolled for booking alerts. The Owner and device notification permission remain separate concepts.
- The database migration `20261120130000_workspace_members_auto_booking_alerts.sql` backfilled existing workspace members into `pac_booking_notification_admins` and created an after-insert/update trigger for newly paired or re-paired devices.
- Live database check: 36 workspace member identities and 36 active booking-alert permission rows. This is an identity count, not a count of physical phones/laptops; old anonymous installation identities may remain. Do not delete these identities without the Owner identifying the intended five devices.
- If a booking-only staff phone has lost its member session, re-enrol it using the PAC booking workflow. Do not change the Owner membership or canonical data key merely because a phone has a fresh identity.
- Do not clear the active Owner phone's app/WebView data or uninstall it without a verified Owner recovery path.

## 4. Booking page request flow

1. Customer opens the Vercel booking page.
2. The page sends `public-config` to `booking-api` to load business hours, services and vehicle categories.
3. When a customer chooses a date and wash service, it sends `availability` to retrieve live slots.
4. Customer submits the form; it sends `create-public`.
5. The backend validates the data and checks overlapping pending/confirmed/rescheduled bookings using the database's capacity/locking logic.
6. A successful request is saved as **Pending**, not automatically confirmed. Prime Auto Care must accept/confirm it.
7. Booking events are recorded for the internal booking desk. Paired devices receive live Realtime events/fallback refresh; native Android notifications require the app to be active and notification permission granted. Background delivery while the app is fully closed still needs FCM setup.

Relevant code:
- Device and booking alert setup: `AI_HANDOVER/BOOKING_NOTIFICATIONS.md`.
- Public form and API calls: `car-wash-erp/website/booking/index.html`.
- Business website and booking link: `car-wash-erp/website/index.html`.
- App booking panel/rendering: `car-wash-erp/index.html`.
- Booking API client wrapper: `car-wash-erp/src/bookings.js`.
- Booking API server: `car-wash-erp/supabase/functions/booking-api/index.ts`.
- Booking notification and pairing logic is also in the booking API server and its database migrations.

## 5. Main source tree map

| Path | Purpose |
|---|---|
| `car-wash-erp/index.html` | Main mobile/PWA application shell and module rendering |
| `car-wash-erp/src/` | Application modules and business logic |
| `car-wash-erp/src/bookings.js` | Authenticated booking API client methods |
| `car-wash-erp/src/cloud-sync.js` | Shared Supabase workspace sync and device pairing |
| `car-wash-erp/supabase/functions/booking-api/` | Booking, availability, status and notification API |
| `car-wash-erp/supabase/functions/public-reviews/` | Safe public review feed for the website |
| `car-wash-erp/supabase/functions/google-review-api/` | Authenticated Google Business Profile/review operations |
| `car-wash-erp/supabase/functions/google-review-oauth-callback/` | Google OAuth callback |
| `car-wash-erp/supabase/functions/google-review-worker/` | Review sync/worker operations |
| `car-wash-erp/supabase/functions/google-review-pubsub-webhook/` | Google Pub/Sub notification receiver |
| `car-wash-erp/supabase/functions/prime-auto-care-site/` | Legacy route redirect to Vercel |
| `car-wash-erp/supabase/functions/prime-auto-care-booking/` | Legacy booking route redirect to Vercel |
| `car-wash-erp/supabase/functions/prime-auto-care-website/` | Legacy website route redirect to Vercel |
| `car-wash-erp/supabase/migrations/` | Production schema and additive database migrations |
| `car-wash-erp/cloud-sync-setup.sql` | Initial shared-cloud setup; one-time setup only |
| `car-wash-erp/website/` | Public business website and customer booking page |
| `car-wash-erp/electron/` | Windows desktop application shell |
| `car-wash-erp/package.json` | Version, dependencies and build scripts |
| `.github/workflows/build-installers.yml` | CI builds Android APK, Windows EXE, source archives and handover release |
| `AI_HANDOVER/` | Project state, release caveats, setup guides and continuity notes |

The source archive intentionally excludes generated dependency/build folders and environment-secret files. Install dependencies through the package manager rather than copying `node_modules`.

## 6. Build and release workflow

Main CI workflow: `.github/workflows/build-installers.yml`.

On changes under `car-wash-erp/**` or to that workflow on `main`, GitHub Actions builds:
- Windows x64 installer EXE (with portable fallback if NSIS build fails).
- Android debug APK.
- Edge Function type checks.
- Project source archive.
- Complete repository + AI handover archive.
- Full release ZIP with file checksums and a START-HERE note.

Expected toolchain in CI:
- Node.js 22
- Python 3.12
- Java 21
- Gradle wrapper
- Capacitor 8
- Electron Builder

The workflow runs `npm install`, `npm run prepare:assets`, `npm run validate`, builds the Windows installer, creates Android web assets, runs `npx cap sync android`, then `./gradlew assembleDebug`. It packages artifacts only after Android, Windows and backend checks succeed.

### Android signing warning

The CI APK is debug-signed with a runner-generated key. Its signing certificate differs from the installed app's certificate. The original production keystore has not been found. Android will reject an in-place update. **Do not uninstall or overwrite the existing Owner phone app.** A production upgrade requires the original keystore or a separately approved migration plan that preserves the active anonymous Owner session and local business data.

The Windows EXE can be rebuilt by CI. Keep a backup and verify its user-data path before testing any installer over an existing business installation.

## 7. External accounts, emails and credentials

- GitHub repository owner/login: `zaid404sec`. The connected GitHub integration has repository access.
- Vercel hosts the static public pages. The current project is in the connected Vercel team; automatic Git linking still requires a GitHub Login Connection in Vercel.
- Supabase hosts the production database and Edge Functions.
- Existing staff/member device identities may still be anonymous Supabase Auth users. The Owner identity is the registered email/password account stated above; use the live Supabase user/membership records as authoritative.
- The public customer booking page does not require customer sign-in or an email address.
- The app's device/workspace pairing flow does not use SMTP/email magic links. Do not configure an email provider as a substitute for Owner identity recovery.
- Google Business Profile API approval, original business-owner OAuth consent and Pub/Sub/OIDC configuration are external prerequisites for live Google review synchronization/automation. Check `AI_HANDOVER/GOOGLE_REVIEW_SETUP_GUIDE.md`.
- Background push while the app is fully closed requires Firebase Cloud Messaging configuration.
- API keys, Supabase service-role secrets, OAuth credentials, tokens and signing keystores must remain in server-side secret stores or the appropriate account's secret manager. Never copy them into source, build artifacts, documentation or chat.

## 8. Data safety rules

1. Never reset or recreate the live Supabase project.
2. Never rerun `cloud-sync-setup.sql` on production; it is initial one-time setup.
3. Do not run `supabase db push` until remote/local migration history is reconciled.
4. Preserve current anonymous Owner session on the active phone.
5. Never use a guessed pairing code, service key or email address.
6. Test public bookings with explicit owner approval and clean test data; do not create fictitious customer bookings in production as a health check.

## 9. Historical and remaining integration work

- Google API Basic Access approval, original-owner OAuth consent and Google Pub/Sub/OIDC configuration must be verified before claiming live Google review sync or automatic replies. AI replies remain disabled by default unless the Owner explicitly configures and enables them.
- Background remote push notifications still require FCM.
- Vercel Git auto-deployment still needs the GitHub Login Connection and repository link.
- Check the latest Actions run and download artifacts from the same successful run. Do not use stale artifacts from earlier runs.
