# Project state — Prime Auto Care / WashDesk

_Last repository verification: 16 November 2026_

## Source of truth

| Item | Current verified value |
|---|---|
| GitHub repository | https://github.com/zaid404sec/zaid404sec |
| Default branch | `main` |
| Application source directory | `car-wash-erp/` |
| App name in Android | Prime Auto Care |
| Package / npm version | `2.8.2` |
| Android application ID | `com.washdesk.carwash.v19` |
| Capacitor | 8.x |
| Node version used in CI | 22 |
| Python version used in CI | 3.12 |
| Android Java version used in CI | 21 |
| Latest verified baseline commit | `1f6d243db00ee35ab46d4a652ca29d82942f2c94` |
| Release PR | #40 — merged |
| PR URL | https://github.com/zaid404sec/zaid404sec/pull/40 |

Always verify these values against the live repository. This table is a checkpoint, not a substitute for checking `main`.

## Product summary

Prime Auto Care / WashDesk is a mobile-first car-wash business management application. The primary implementation is a web app packaged for Android through Capacitor, with a Windows desktop build through Electron and an installable PWA path. The app handles real business data: customers, vehicles, services, invoices, payments, stock, purchases, expenses, employees, attendance, payroll, advances and reporting.

### Features recorded in the 2.8.2 baseline

- Customer and vehicle register, visit history and vehicle classification.
- Service catalogue, vehicle-category pricing, taxi/commercial distinction and service line items.
- Invoice creation, financial-year numbering, discounts, configured GST values, partial payments, due balances and locally generated A4 invoice PDFs.
- Android save/share workflow for invoice PDFs and WhatsApp sharing through the native share sheet.
- Selectable invoice PDF templates: default gold/black, Navy, Forest Green and Burgundy.
- Inventory, low-stock alerts, purchases, stock adjustments, weighted-average purchase cost and optional per-service consumable recipes.
- Staff directory, attendance, optional daily hours worked, salary accrual, payments, advances and employee-specific PDF/Excel statements for a date range.
- Date-wise business report and export, plus monthly workbook reporting.
- Dashboard monthly daily-sales chart showing ₹ sales and invoice counts; selecting a bar opens the corresponding date.
- Expense management and separate personal/household expense heads.
- JSON backup and restore, invoice CSV export and optional shared cloud database.
- Local daily reminder defaults to 7:50 AM Asia/Kolkata, with permission handling, pending-reminder visibility, next scheduled time and test notification.
- Offline app shell / PWA support.

For the precise shipped behavior and limitations, read `car-wash-erp/README.md` and inspect the current source.

## Key 2.8.2 changes from PR #40

- Fixed an invoice theme initialization bug that could throw a temporal-dead-zone ReferenceError in PDF generation.
- Kept the existing gold/black invoice as default; added three selectable color alternatives.
- Added optional hours-worked input to daily staff attendance.
- Added individual employee PDF and Excel statements over a selected date range, including attendance, hours where recorded, pay accrual, absences, salary payments, advance adjustments, issued/outstanding advances, deductions and final balance.
- Added selected-date business report and export with sales, invoice count, payments/collections, invoice dues, purchases, operating expenses, staff payments and advances.
- Expanded dashboard daily-sales chart to the selected month with amounts/counts and date selection.
- Improved daily reminder status, permission flow, test notification, duplicate prevention and rescheduling at startup.
- Normalised vehicle category handling so taxi is counted as a four-wheeler while commercial is reported separately.
- Updated cache version and validation assertions.
- Bumped npm app version to 2.8.2.

## Latest verified build

GitHub Actions run:  
https://github.com/zaid404sec/zaid404sec/actions/runs/43867694662

- Android job: completed successfully.
- Windows EXE installer job: completed successfully.
- The Android job ran `npm run validate`, Capacitor sync, Gradle `assembleDebug` and APK artifact upload.
- The Windows job completed its EXE installer build and artifact upload.
- This is CI evidence, not physical device acceptance testing.

APK build artifact:
- Artifact name: `WashDesk-Android-APK`
- Artifact ID: `14226003280`
- Artifact archive SHA-256: `fbb9d364b2ba3484ec290289a2e54e4b21163ba94f89844b998890b43b7524a5`
- Extracted APK size: 6,526,694 bytes (about 6.22 MiB / 6.5 MB decimal).
- APK SHA-256: `f9c7b7ef216448d021560ab8045b2f5f65776ab0a46fc7b998fb93931648c712`
- Embedded app ID checked in the APK: `com.washdesk.carwash.v19`.

The exact APK from this run was supplied separately as `Prime-Auto-Care-2.8.2.apk`. The GitHub Actions artifact is the reproducible source of this build.

## Android install and data safety

**The 2.8.2 APK is a debug build with package ID `com.washdesk.carwash.v19`.**

- It was intentionally given a new app ID so it can install alongside the previous v18 app when the build uses an ephemeral debug signing key.
- Installing v19 does not automatically update/replace v18.
- Keep v18 installed. Do not uninstall it or clear its data while checking v19.
- Before switching normal business use, confirm the cloud workspace is connected and records have synced, or export a JSON backup from the old app and confirm that backup can be restored.
- In v19, verify customer, vehicle, invoice, payment, staff, inventory and expense records before considering v18 retirement.
- Do not ask the owner to uninstall the old app as a troubleshooting step.

For future builds, first inspect the current app ID and signing arrangement. A package ID change is not an ordinary version bump. A persistent release keystore could enable in-place updates, but only if managed securely (for example as protected GitHub Actions secrets) and with an intentional signing continuity plan. Never put a keystore, password or signing secret in the public repo or handover ZIP.

## Reminder verification status

The 2.8.2 code schedules a daily 7:50 AM Asia/Kolkata reminder and reconciles its local notification schedule when the app starts. It shows permission / pending / next-time status and a test-notification action.

**Not claimed as verified on a physical phone:** actual delivery after phone reboot, Android Doze, battery optimisation, permission denial/re-grant, OS vendor autostart restrictions and long-term alarm reliability. These require real device acceptance checks. Do not promise guaranteed reboot delivery based on CI alone.

## Cloud and real-data safety

The app has optional shared cloud database functionality through Supabase. Read these carefully before touching anything cloud-related:
- `car-wash-erp/README.md`
- `car-wash-erp/cloud-sync-setup.sql`
- `car-wash-erp/src/cloud-sync.js`
- `car-wash-erp/supabase/`

Do not change the Supabase project, pairing model, row identity, merge logic or schema without tracing the current code and checking backward compatibility. The SQL setup file and the app migrations are part of the existing system. Do not run setup SQL again as a shortcut on an existing live workspace. Do not reveal, log or commit pairing codes or Supabase credentials.

## Known product limitations to retain unless explicitly addressed

The README states this is not a full double-entry accounting product or a statutory compliance product. Among the functions not represented as complete are audited Profit & Loss / Balance Sheet, bank reconciliation, GST return filing, IRN e-invoicing, e-way bills, payroll statutory compliance and complete supplier ledgers. Tax configuration and invoice legal details should be checked by the business's chartered accountant. Do not claim legal, accounting or tax compliance without appropriate review.

WhatsApp messages are user-initiated unless the official WhatsApp Business Platform has been configured; do not imply that the app can silently send messages through a personal WhatsApp account.

## Current development posture

The 2.8.2 baseline has passed the repository's Android and Windows CI pipeline. Future work should be implemented incrementally with:
- explicit feature requirements and acceptance criteria;
- a small, focused branch and reviewable diff;
- regression tests for existing calculations and workflows;
- validation and complete CI;
- safe database migrations where required;
- a real-device check for Android-only/native behavior;
- a fresh build artifact linked in the final response.
