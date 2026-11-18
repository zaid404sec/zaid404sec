# Feature and source code map

The current source is in `car-wash-erp/`. Inspect live files before editing; line numbers and helper names will change over time.

| Area | Primary files / paths | Notes |
|---|---|---|
| Main UI and business logic | `car-wash-erp/index.html` | Main application UI and much of the client-side business logic currently live here. It is a large file; make narrow, targeted edits. |
| Package version and scripts | `car-wash-erp/package.json` | Version, validation command, asset preparation and Windows build scripts. |
| Android app metadata | `car-wash-erp/capacitor.config.json` | App ID and app name. Never change the ID casually. |
| Native Android build | `.github/workflows/build-installers.yml` | Android Capacitor sync, generated assets, Java/Gradle and debug APK build. |
| Windows installer | `.github/workflows/build-installers.yml`, `car-wash-erp/electron/`, `car-wash-erp/electron-builder.yml` | Electron installer pipeline. |
| App regression validator | `car-wash-erp/scripts/validate-app.mjs` | Runs as `npm run validate`. Extend assertions when new business calculations or critical behaviors are added. |
| Number & notification groups | `car-wash-erp/index.html`, `car-wash-erp/scripts/validate-app.mjs`, `car-wash-erp/supabase/migrations/20261118050000_add_message_recipients_sync_merge.sql` | Adds named recipients, Indian number validation, multi-group assignment, attendance/expense message templates and manual one-to-one WhatsApp handoff. Recipient records synchronize as `messageRecipients`; no automatic group broadcast. |
| Staff payroll and individual statements | `car-wash-erp/index.html`, `car-wash-erp/src/report-export.js` | `staffPayrollBreakdown` calculates earned salary, full outstanding advances and negative recovery balance; `advanceDeduction` remains capped for actual salary settlement. `buildStaffStatement` scopes data to one employee; `report-export.js` creates the selected employee's Excel workbook. Keep PDF/Excel and table totals consistent. |
| Local notifications | `car-wash-erp/src/local-notifications.js` | Reminder scheduling, permission handling, pending state and test notification. |
| Cloud data synchronization | `car-wash-erp/src/cloud-sync.js` | Supabase client and data-sync logic. Treat edits here as data-sensitive. |
| Cloud schema/setup | `car-wash-erp/cloud-sync-setup.sql` | Existing workspace setup SQL; do not rerun against production as an update shortcut. |
| Cloud Edge Functions | `car-wash-erp/supabase/functions/` | Communication API, webhook and worker. Secrets must remain outside Git. |
| Database migrations | `car-wash-erp/supabase/migrations/` | Additive, backwards-compatible migrations only after examining deployed schema. |
| Reports and exports | `car-wash-erp/index.html`, `car-wash-erp/src/report-export.js` | `buildDateWiseBusinessReport` is the shared selected-day dataset. `exportDailyBusinessReportPdf` creates an A4 landscape PDF; `exportDailyBusinessReportExcel` calls the multi-sheet Excel exporter. Monthly Excel workbook remains separate. Keep selected-date totals consistent across screen, PDF and workbook. |
| Dashboard weekly sales trend and Recent Invoices | `car-wash-erp/index.html` | ISO week helpers (`isoWeekKey`, `isoWeekStart`, `addDateDays`) drive Monday–Sunday daily sales bars. Recent invoice cards use the existing `data-invoice` click delegation to open the invoice. |
| Native invoice file handling | `car-wash-erp/src/invoice-native.js` | Native save/share helpers. |
| Native URL / app links | `car-wash-erp/src/native-links.js` | External navigation and native-link helpers. |
| Communications | `car-wash-erp/src/communications.js`, `car-wash-erp/supabase/functions/` | Check provider configuration and secret handling before changing. |
| Offline app shell | `car-wash-erp/sw.js`, `car-wash-erp/manifest.webmanifest` | Update cache version when cached app assets change. |
| Branding assets | `car-wash-erp/prime-auto-care-logo.jpg`, `car-wash-erp/prime-auto-care-car-photo.jpg`, `car-wash-erp/icon.svg`, `car-wash-erp/scripts/generate-brand-assets.py` | Avoid replacing the established identity without request. |

## Reporting and dashboard rule (2.8.4)

- Date-wise PDF and Excel exports must use `buildDateWiseBusinessReport(dateKey)` as their single data source.
- Keep all records filtered to the selected business date. Keep personal/household expenses and staff advances separate from operating expenses to avoid double counting.
- Preserve the seven Excel sheets and corresponding PDF sections. If a field is added, update both formats and regression tests.
- Weekly trend uses ISO week numbers and seven local calendar dates, Monday through Sunday. Keep year-boundary behavior covered by tests.
- Recent invoice cards must continue using the established `data-invoice` click handler and preserve cancelled/paid/due status.

## Payroll balance rule (2.8.3)

- Monthly Net Payable is earned salary less cash salary already paid and **all** remaining open staff advances.
- A negative number is a recovery amount owed by staff to the business; do not clamp it to zero.
- The amount that can be recorded as a salary advance adjustment is still capped at the remaining salary balance. Do not use the negative Net Payable figure as a new cash payment or automatically over-adjust the advance ledger.
- Individual statement data must always be filtered by the selected staff ID; include the employee name and statement date range in the export summary and filename.

## Safe extension pattern for a new feature

For a proposed feature such as appointment booking:

1. Map the complete user journey first (create, edit, reschedule, cancel, view, search, permissions and notifications).
2. Check whether existing customer, vehicle, service, staff, calendar, invoice and cloud records can be reused. Avoid duplicating concepts.
3. Decide which fields/data need to persist locally and whether they must synchronize across devices.
4. Design an additive data model with stable IDs, timestamps, status transitions and backward-compatible reads.
5. Build the UI in the existing visual system; keep current invoice, dashboard and business workflows intact.
6. Add input validation, duplicate/overlap checks, timezone handling, offline conflict behavior and clear empty/error states.
7. Add tests to `scripts/validate-app.mjs` for core logic and regressions. If a database migration is needed, add a new migration file; do not rewrite or delete an already deployed migration.
8. Verify build artifacts and perform real-device tests for notifications, navigation, offline use and shared-device syncing where relevant.

Booking examples are guidance only; do not implement them unless the user requests them.


## AI Growth Studio and local visibility (2.10.0)

| Area | Primary files / paths | Notes |
|---|---|---|
| Google Review Center and Growth Studio UI | car-wash-erp/index.html | Manual review composer, AI reply draft, free-model key management, keyword planner, daily post library, upload controls and owner-reviewed publish flow. |
| Free AI request client | car-wash-erp/src/google-reviews.js | Sends authenticated actions to the Google Review API. Exposes aiGenerate, ensureDailyGrowthPosts, growth post/keyword reads/writes, photo upload and optional Google publishing. Never put server secrets here. |
| Growth AI prompts and free provider path | car-wash-erp/supabase/functions/google-review-api/index.ts | Only OpenRouter free model route / :free IDs are allowed by ai-generate. The browser key is passed for a single request and is not stored server-side. Drafts are owner-reviewed. |
| Shared daily draft guard | car-wash-erp/supabase/migrations/20261118143000_google_growth_daily_runs.sql | Unique workspace/date row prevents duplicate daily generation from paired devices. RLS and grants restrict access to service_role. |
| Growth post/keyword data | car-wash-erp/supabase/migrations/20261118110000_google_ai_growth_studio.sql | Workspace-scoped posts and keyword suggestions; RLS enabled; no direct authenticated-table read/write grants. |
| Business photo storage | Supabase bucket pac-google-growth-media | Public read for Google media fetch; service-side upload only; JPG/PNG, 5 MB max. Browser file checks require 250 × 250 px minimum. |
| Branded poster output | car-wash-erp/index.html | Creates a 1080 × 1350 gold-glass text overlay using the owner-uploaded photo. It must not invent a wash outcome, customer or fake vehicle image. |
| Keyword evidence | car-wash-erp/index.html and google-review-api/index.ts | AI relevance is an editorial score, not measured search volume. Each suggestion links to Google Trends for owner comparison. Do not add invented volume values. |
| Website and WhatsApp enquiry | car-wash-erp/website/index.html | Local business content/structured data, canonical/social metadata, location, hours, Google link and a WhatsApp enquiry form. It does not confirm bookings or accept deposits. |
| Website publishing | .github/workflows/pages.yml | GitHub Pages must be set to Source = GitHub Actions in repository Settings → Pages. Confirm a successful deploy job and open the public website URL before calling it live. |

## 2.10.0 operational boundaries

- Daily post drafts are attempted when an authorised device opens Google Review Center with a free OpenRouter key saved locally. This is not a background worker while the app is closed.
- The free key is local to each device and must not be added to shared cloud data, source files, backup files, screenshots or handover ZIPs.
- Google review import, direct API replies, Google post/photo publishing and Pub/Sub notifications remain gated by Google Basic API Access and OAuth configuration.
- Until those Google prerequisites pass, publish replies and posts manually in Google after reviewing copied drafts.
- Future online booking and advance payment must use an additive booking model, slot-capacity rules, refund/cancellation policy and a configured payment-provider merchant account with verified webhooks. The 2.10.0 website is enquiry-only.
