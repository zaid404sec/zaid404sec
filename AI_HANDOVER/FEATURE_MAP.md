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
| Local notifications | `car-wash-erp/src/local-notifications.js` | Reminder scheduling, permission handling, pending state and test notification. |
| Cloud data synchronization | `car-wash-erp/src/cloud-sync.js` | Supabase client and data-sync logic. Treat edits here as data-sensitive. |
| Cloud schema/setup | `car-wash-erp/cloud-sync-setup.sql` | Existing workspace setup SQL; do not rerun against production as an update shortcut. |
| Cloud Edge Functions | `car-wash-erp/supabase/functions/` | Communication API, webhook and worker. Secrets must remain outside Git. |
| Database migrations | `car-wash-erp/supabase/migrations/` | Additive, backwards-compatible migrations only after examining deployed schema. |
| Reports and exports | `car-wash-erp/src/report-export.js` | Excel/report generation helpers. Check consistency with on-screen totals. |
| Native invoice file handling | `car-wash-erp/src/invoice-native.js` | Native save/share helpers. |
| Native URL / app links | `car-wash-erp/src/native-links.js` | External navigation and native-link helpers. |
| Communications | `car-wash-erp/src/communications.js`, `car-wash-erp/supabase/functions/` | Check provider configuration and secret handling before changing. |
| Offline app shell | `car-wash-erp/sw.js`, `car-wash-erp/manifest.webmanifest` | Update cache version when cached app assets change. |
| Branding assets | `car-wash-erp/prime-auto-care-logo.jpg`, `car-wash-erp/prime-auto-care-car-photo.jpg`, `car-wash-erp/icon.svg`, `car-wash-erp/scripts/generate-brand-assets.py` | Avoid replacing the established identity without request. |

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
