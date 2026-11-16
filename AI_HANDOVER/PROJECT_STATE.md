# Project state — Prime Auto Care / WashDesk

_Last repository verification: 16 November 2026_

## Source of truth

| Item | Current verified value |
|---|---|
| GitHub repository | https://github.com/zaid404sec/zaid404sec |
| Default branch | `main` |
| Application source directory | `car-wash-erp/` |
| Android app name | Prime Auto Care |
| App version | `2.8.4` |
| Android application ID | `com.washdesk.carwash.v21` |
| Capacitor | 8.x |
| Node version in CI | 22 |
| Python version in CI | 3.12 |
| Android Java version in CI | 21 |
| App release source commit | `b5c9954e71aef18cf9195ce4d0a47fbe4b23e834` |
| Handover update PR #44 commit | `23b4e5cf8a42cc8483b4a4068ef45e486677ae9f` |
| Handover correction PR #45 commit | `3d5f1a088a3e0d189ac7185191118baf11d8cbd5` |
| Release PR | [#47 — merged](https://github.com/zaid404sec/zaid404sec/pull/47) |
| Release workflow | [Run #188 — Android + Windows succeeded](https://github.com/zaid404sec/zaid404sec/actions/runs/43888779236) |

Always inspect live `main` before changing code; this file is a checkpoint, not a replacement for source inspection. The application code is released at `b5c9954`. PRs #44 and #45 were earlier handover-documentation updates; PR #47 contains the 2.8.4 app release.

## Product summary

Prime Auto Care / WashDesk is a mobile-first car-wash business manager. The source is a web app packaged for Android with Capacitor, with a Windows desktop build through Electron and a PWA path. It stores real business data, including customers, vehicles, service catalogue, invoices, payments, stock, purchases, expenses, staff, attendance, salary settlements, advances and reports.

## Current feature baseline (2.8.4)

- Customer and vehicle register, vehicle history, duplicate checks and vehicle classification.
- Service catalogue, private/taxi/commercial/SUV pricing and multi-line invoices.
- Financial-year invoice numbering, discounts, configured GST, partial payments, due balances, A4 PDF bills and Android save/share / WhatsApp handoff.
- Selectable invoice PDF palettes: original gold/black, Navy, Forest Green and Burgundy.
- Inventory, stock movement ledger, low-stock alerts, purchases, weighted-average costs and optional per-service consumable recipes.
- Staff directory, individual Present/Absent attendance, optional daily hours, shifts, accrued salary, salary payments and advances.
- Individual employee PDF and Excel statements for a chosen date range. Each export identifies the selected employee and date range in its dialog, summary, filename and confirmation.
- Monthly payroll Net Payable subtracts the full outstanding advance liability. If advances exceed earned salary, it displays a negative recovery balance in red. A separate staff recovery total is shown. Actual salary-settlement adjustments remain capped at the salary available.
- Date-wise business report with separate A4 landscape PDF and multi-sheet Excel workbook exports, both using the same selected-date dataset: daily summary, sales register, collections, purchases, business expenses, personal/household expenses and staff advances.
- Monthly Excel business workbook remains available. Dashboard sales trend is now a selectable ISO weekly chart (Monday–Sunday) with seven daily bars, invoice counts and rupee totals.
- Dashboard Recent Invoices uses responsive tap-to-open invoice cards with customer, vehicle, status, amount and due balance.
- Business and personal/household expense tracking.
- JSON backup/restore, invoice CSV export, optional shared cloud data via Supabase and offline app-shell support.
- Daily local reminder defaults to 7:50 AM Asia/Kolkata, with permission handling, status/next-time display and test-notification action.

For exact behavior, limitations and integration details, inspect the live source and `car-wash-erp/README.md`.

## Key 2.8.4 changes from PR #47

- Added selected-date business report export to a professional A4 landscape PDF and a seven-sheet Excel workbook. Both are generated from the same date-filtered report model.
- PDF and Excel contain daily summary, sales register, payments received, purchases, business expenses, personal/household expenses and staff advances.
- Replaced the dashboard Monthly Sales Trend with a selectable ISO weekly sales trend, Monday through Sunday, with daily amounts and invoice counts.
- Reworked Recent Invoices into responsive, touch-friendly invoice cards that open the selected invoice.
- Updated the service-worker cache to v25.
- Bumped app version to 2.8.4 and Android package ID to v21 for a separate debug install. Keep v20 installed until v21 cloud sync or backup restoration is verified.

## Key 2.8.3 changes from PR #43

- Fixed the payroll calculation so `netPayable = balanceBeforeAdvances - openAdvances`; the displayed balance uses all outstanding advances instead of the salary-capped advance adjustment.
- Kept `advanceDeduction` capped at the remaining salary amount. The salary-settlement form therefore cannot consume more salary than is available.
- Added a visible red **Recovery due** label for negative employee Net Payable and a separate **Staff recovery due** summary card.
- Changed the salary-payable card to sum only positive salary liability, so negative employee balances do not offset payroll owed to other staff.
- Made individual statement identity explicit: employee name, role and selected range appear in the statement summary; the export dialog/buttons and success confirmation name the employee.
- Added a regression case: ₹2,500 in open advances against ₹1,000 earned salary must display **−₹1,500**, while salary adjustment remains capped at ₹1,000.
- Updated the service worker cache to v24.
- Bumped app version to 2.8.3 and Android package ID to v20 for the separate debug install described below.

## Latest verified 2.8.4 main-branch build

GitHub Actions run #190 (main branch, merged release commit):  
https://github.com/zaid404sec/zaid404sec/actions/runs/43889275791

Both required jobs completed successfully:
- Android APK — success.
- Windows EXE installer — success.

The Android job completed asset generation, `npm run validate`, Capacitor preparation/sync, Gradle `assembleDebug` and APK artifact upload. The validator includes regression coverage for the excess-advance negative balance and employee-specific statement identity. The Windows EXE build and artifact upload also succeeded.

### APK artifact and fingerprint

- Artifact name: `WashDesk-Android-APK`
- Artifact ID: `14235253589`
- Artifact archive SHA-256: `65b659ade9050c81f1c9085b656bd73474302ff0ef6bbd3cd029f13882a9430b`
- Delivered file name: `Prime-Auto-Care-2.8.4.apk`
- APK size: 6,532,798 bytes (about 6.23 MiB / 6.53 MB decimal).
- APK SHA-256: `973134dfab11c754f9ef963339ebed1ab9d30693d1eae50ecacce3656310661a`
- Embedded Android app ID: `com.washdesk.carwash.v21`
- Build type: debug APK.

The main-branch artifact ZIP and APK both passed ZIP integrity verification. The package ID is confirmed by the release source configuration and validator; the APK was not separately decoded with Android SDK tooling in this environment.

## Android install and data safety

**2.8.4 is a debug APK using package ID `com.washdesk.carwash.v21`.** The build workflow currently does not use a persistent release-signing key, so v21 was selected to install beside the previous v20 app.

- Installing v21 does not automatically update or replace v20.
- Keep v20 installed. Do not uninstall it or clear its data while checking v21.
- The new package has separate local app storage. Existing v20-only local records are not automatically copied into v21.
- Before moving normal business use to v21, connect it to the same shared cloud workspace and verify that records sync, or export a JSON backup from v20 and restore it in v21.
- Check customer, vehicle, invoice, payment, staff, payroll, advance, inventory and expense records before considering v20 retirement.
- Never tell the owner to uninstall the old app as a troubleshooting step.

A persistent signing key could enable in-place updates, but only with a deliberate signing continuity plan and protected GitHub Actions secrets. Never place a keystore or password in the public repository or handover ZIP. Do not change the app ID casually.

## Physical device verification still required

CI success is not a real handset test. Still check on the owner's Android phone:
- notification permission, test notification and scheduled reminder after reboot;
- battery optimisation / Doze and device-vendor background restrictions;
- native PDF save/share and WhatsApp handoff;
- cloud sync during offline/online changes;
- restoration from the actual business backup.

Do not claim these were tested unless someone tests them on the phone.

## Cloud and real-data safety

The optional shared workspace uses Supabase. Before cloud-related changes, inspect:
- `car-wash-erp/README.md`
- `car-wash-erp/cloud-sync-setup.sql`
- `car-wash-erp/src/cloud-sync.js`
- `car-wash-erp/supabase/`

Do not replace the Supabase project, pairing model, record identity or merge logic. Do not re-run one-time setup SQL on a live workspace as an update shortcut. Never expose pairing codes or credentials.

## Product limitations to preserve truthfully

The README states this is not a complete double-entry accounting or statutory compliance product. Do not claim audited P&L / balance sheet, bank reconciliation, GST return filing, IRN e-invoicing, e-way bills, statutory payroll compliance or complete supplier ledgers. Have the business's chartered accountant check tax configuration and legal invoice particulars. WhatsApp sends remain user-initiated unless the official WhatsApp Business Platform is configured.

## Development posture for the next AI

For every future feature:
1. Verify latest `main`, app version, app ID and workflow status.
2. Read the handover files and inspect related source/test code.
3. Make the smallest focused change on a feature branch and PR.
4. Preserve existing data and unrelated features; prefer additive migrations.
5. Extend `npm run validate` for important calculations and regression risks.
6. Pass the full Android + Windows workflow before merge.
7. After merge, verify the main build, retrieve the APK, check integrity, size and SHA-256.
8. Update this handover, add a historical release note and refresh the downloadable handover ZIP.

The owner uses Android and does not use terminal, Git CLI, Android Studio or SSH keys. Use connected GitHub tools and GitHub Actions; do not ask the owner to edit source files or provide secrets.
