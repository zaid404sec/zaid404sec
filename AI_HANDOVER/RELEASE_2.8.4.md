# Prime Auto Care 2.8.4 — Release record

- Release date: 16 November 2026
- Pull request: [#47 — merged](https://github.com/zaid404sec/zaid404sec/pull/47)
- Main merge commit: `b5c9954e71aef18cf9195ce4d0a47fbe4b23e834`
- CI workflow run: [#190 — main-branch Android and Windows jobs succeeded](https://github.com/zaid404sec/zaid404sec/actions/runs/43889275791)
- App version: `2.8.4`
- Android application ID: `com.washdesk.carwash.v21`
- Artifact: `WashDesk-Android-APK` (ID `14234694316`)
- Artifact archive SHA-256 digest: `65b659ade9050c81f1c9085b656bd73474302ff0ef6bbd3cd029f13882a9430b`
- APK file: `Prime-Auto-Care-2.8.4.apk`
- APK size: 6,532,798 bytes
- APK SHA-256: `973134dfab11c754f9ef963339ebed1ab9d30693d1eae50ecacce3656310661a`
- APK archive integrity: verified; no ZIP errors.
- Automated validation: passed, including daily report filtering/totals, Excel workbook sheet presence, ISO week boundary behavior, weekly chart labels, dashboard invoice cards and existing payroll regressions.
- Android CI: successful, including `npm run validate`, Capacitor sync, Gradle debug build and artifact upload.
- Windows CI: successful, including installer build and artifact upload.

## Changes

1. Date-wise business report exports to an A4 landscape PDF and multi-sheet Excel workbook. Both use the same selected-date dataset and include daily summary, sales register, collections, purchases, business expenses, personal/household expenses and staff advances.
2. Dashboard Monthly Sales Trend replaced by selectable ISO Weekly Sales Trend (Monday–Sunday) with daily sales values and invoice counts.
3. Recent Invoices redesigned as responsive tap-to-open cards showing invoice, customer, vehicle, status, amount and due information.
4. Service worker cache updated to v25.

## Installation and data warning

This is a debug APK built with the CI debug signing key and uses a new package ID, `com.washdesk.carwash.v21`. It installs beside v20 rather than updating it and does not automatically migrate v20's local-only app storage. Keep v20 installed. Before using v21 for live billing, connect it to the same Supabase cloud workspace and verify records, or export a JSON backup from v20 and restore it into v21.

## Device testing caveat

CI verifies source syntax, regression calculations and successful builds. Real handset acceptance is still required for PDF/Excel saving and opening, touch behavior, cloud sync and backup restoration. Do not claim these have been tested on the owner's phone.
