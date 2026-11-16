# Project state — Prime Auto Care / WashDesk

_Last repository verification: 16 November 2026_

## Source of truth

| Item | Current verified value |
|---|---|
| GitHub repository | https://github.com/zaid404sec/zaid404sec |
| Default branch | `main` |
| Application source directory | `car-wash-erp/` |
| Android app name | Prime Auto Care |
| App version | `2.8.3` |
| Android application ID | `com.washdesk.carwash.v20` |
| Capacitor | 8.x |
| Node version in CI | 22 |
| Python version in CI | 3.12 |
| Android Java version in CI | 21 |
| Latest verified main commit | `52ac00acd65b251c3497d16a6eb2c69cdb5d5774` |
| Release PR | [#43 — merged](https://github.com/zaid404sec/zaid404sec/pull/43) |
| Main release workflow | [Run #185](https://github.com/zaid404sec/zaid404sec/actions/runs/43873773360) |

Always inspect live `main` before changing code; this file is a checkpoint, not a replacement for source inspection.

## Product summary

Prime Auto Care / WashDesk is a mobile-first car-wash business manager. The source is a web app packaged for Android with Capacitor, with a Windows desktop build through Electron and a PWA path. It stores real business data, including customers, vehicles, service catalogue, invoices, payments, stock, purchases, expenses, staff, attendance, salary settlements, advances and reports.

## Current feature baseline (2.8.3)

- Customer and vehicle register, vehicle history, duplicate checks and vehicle classification.
- Service catalogue, private/taxi/commercial/SUV pricing and multi-line invoices.
- Financial-year invoice numbering, discounts, configured GST, partial payments, due balances, A4 PDF bills and Android save/share / WhatsApp handoff.
- Selectable invoice PDF palettes: original gold/black, Navy, Forest Green and Burgundy.
- Inventory, stock movement ledger, low-stock alerts, purchases, weighted-average costs and optional per-service consumable recipes.
- Staff directory, individual Present/Absent attendance, optional daily hours, shifts, accrued salary, salary payments and advances.
- Individual employee PDF and Excel statements for a chosen date range. Each export identifies the selected employee and date range in its dialog, summary, filename and confirmation.
- Monthly payroll Net Payable subtracts the full outstanding advance liability. If advances exceed earned salary, it displays a negative recovery balance in red. A separate staff recovery total is shown. Actual salary-settlement adjustments remain capped at the salary available.
- Date-wise business report and export; monthly Excel workbook; month-wide daily-sales chart with counts and date selection.
- Business and personal/household expense tracking.
- JSON backup/restore, invoice CSV export, optional shared cloud data via Supabase and offline app-shell support.
- Daily local reminder defaults to 7:50 AM Asia/Kolkata, with permission handling, status/next-time display and test-notification action.

For exact behavior, limitations and integration details, inspect the live source and `car-wash-erp/README.md`.

## Key 2.8.3 changes from PR #43

- Fixed the payroll calculation so `netPayable = balanceBeforeAdvances - openAdvances`; the displayed balance uses all outstanding advances instead of the salary-capped advance adjustment.
- Kept `advanceDeduction` capped at the remaining salary amount. The salary-settlement form therefore cannot consume more salary than is available.
- Added a visible red **Recovery due** label for negative employee Net Payable and a separate **Staff recovery due** summary card.
- Changed the salary-payable card to sum only positive salary liability, so negative employee balances do not offset payroll owed to other staff.
- Made individual statement identity explicit: employee name, role and selected range appear in the statement summary; the export dialog/buttons and success confirmation name the employee.
- Added a regression case: ₹2,500 in open advances against ₹1,000 earned salary must display **−₹1,500**, while salary adjustment remains capped at ₹1,000.
- Updated the service worker cache to v24.
- Bumped app version to 2.8.3 and Android package ID to v20 for the separate debug install described below.

## Latest verified main-branch build

GitHub Actions run #185:  
https://github.com/zaid404sec/zaid404sec/actions/runs/43873773360

Both required jobs completed successfully:
- Android APK — success.
- Windows EXE installer — success.

The Android job completed asset generation, `npm run validate`, Capacitor preparation/sync, Gradle `assembleDebug` and APK artifact upload. The validator includes regression coverage for the excess-advance negative balance and employee-specific statement identity. The Windows EXE build and artifact upload also succeeded.

### APK artifact and fingerprint

- Artifact name: `WashDesk-Android-APK`
- Artifact ID: `14227899990`
- Artifact archive SHA-256: `f5962c33e1129d2cdb88cad9a814c77f205833320d3cd8d42ad748ac83361564`
- Delivered file name: `Prime-Auto-Care-2.8.3.apk`
- APK size: 6,527,194 bytes (about 6.23 MiB / 6.53 MB decimal).
- APK SHA-256: `e6aa6a4d99fd135d113a813d6793adda2d886384e8a387a69a5605e461787a64`
- Embedded Android app ID: `com.washdesk.carwash.v20`
- Build type: debug APK.

The artifact ZIP passed integrity verification. The APK itself passed ZIP integrity verification, and its embedded Capacitor config was inspected to confirm the v20 package ID.

## Android install and data safety

**2.8.3 is a debug APK using package ID `com.washdesk.carwash.v20`.** The build workflow currently does not use a persistent release-signing key, so v20 was selected to install beside the previous v19 app.

- Installing v20 does not automatically update or replace v19.
- Keep v19 installed. Do not uninstall it or clear its data while checking v20.
- The new package has separate local app storage. Existing v19-only local records are not automatically copied into v20.
- Before moving normal business use to v20, connect it to the same shared cloud workspace and verify that records sync, or export a JSON backup from v19 and restore it in v20.
- Check customer, vehicle, invoice, payment, staff, payroll, advance, inventory and expense records before considering v19 retirement.
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
