# WashDesk — Car Wash Business Manager

A mobile-friendly, installable starter app tailored to a car washing centre.

## Included
- Customer and vehicle register: contact details, vehicle class, registration number and visit history.
- Service catalogue with standard, private-car, taxi, commercial-vehicle and SUV rates.
- Invoice builder with multiple line items, line and invoice discounts, configured GST rates, financial-year invoice numbering, partial payments and balances.
- Invoice preview, locally generated styled PDF export, native Android save to Downloads, and PDF sharing through the Android share sheet (including WhatsApp).
- Inventory register, low-stock alerts, purchase entries, weighted-average purchase cost and stock adjustments.
- Optional one-consumable-per-service recipe for automatic stock deduction when a service is invoiced.
- Expense register, staff directory, invoice staff assignment and monthly management summaries.
- JSON backup/restore and invoice CSV export.
- Service-worker caching for the app shell and install-to-home-screen support.

## Version 2.1.2 stability release and migration

- **Android:** The 2.1.2 stability APK uses application ID `com.washdesk.carwash.v5` so it can install beside the existing v4 app without risking its local data or requiring the old debug-signing key. Keep the existing app installed. Export a backup from it first. Install the new APK, open Shared Cloud Database, and pair with the same private workspace pairing code. If the old app shows **Connected · all devices synced**, the new app will pull the central cloud records; do not import the same backup again unless cloud data is missing. Use the new app for new bills after confirming the records are present.
- **Windows:** Install the updated EXE over the existing Prime Auto Care app. The Electron user-data folder remains the same.
- **Cloud sync:** The same Supabase workspace, one-time pairing code and server-side merge are retained. Do not disconnect Supabase. Remote snapshots are queued while a device is on the New Bill screen or editing a form, then applied after leaving the form to avoid dismissing Android Gboard and blocking billing. Realtime is still the primary update path; the 30-second reconciliation is only a recovery fallback. Database invoice numbering is reserved centrally before local stock is deducted.

## Version 1.1.0 migration and updates

- **Windows:** Install the new EXE over the existing WashDesk installation in the same folder. Electron stores browser data separately from the installer files; keep a JSON backup before updating.
- **Android:** This build uses a new application ID because the old debug-signing private key is not available in the build environment. It installs beside the previous app so the old records remain untouched. Export a backup from the old app, install **WashDesk Updated**, then use Business Settings → Restore backup once. Do not uninstall the old app until the restored records are checked.
- **Cloud sync:** One Supabase workspace is shared by all paired Android phones and Windows computers. The app has no hard-coded four-device cap; each authorised device joins using the same private pairing code. Enable Supabase Anonymous Sign-Ins once, run `cloud-sync-setup.sql` once in the project's SQL Editor, copy the 64-character pairing code returned by the final SQL query, then enter that same code once on every device. No email link, OTP or custom SMTP is used. Each device receives its own persistent authenticated session and joins the same workspace. Database writes are serialized and merged by record ID, PostgreSQL Realtime pushes committed updates to paired devices, a 30-second safety reconciliation recovers missed socket events, and local changes are merged/pushed after reconnecting from offline mode. Keep the pairing code private; anyone who has it can add a device.

## Important limitations — read before using live business data
Business records are stored locally first and can be synchronized to the shared Supabase workspace once the one-time database setup and device pairing are completed. The app does not provide detailed per-staff permissions or a complete double-entry accounting ledger, bank reconciliation, statutory audited Profit & Loss / Balance Sheet, GST return filing, IRN e-invoice generation, e-way bills, payroll compliance, supplier ledgers or AMC/prepaid wash-pass redemption. Use Export Backup regularly as an independent backup even after cloud sync is active. Do not use a shared/public device for live customer data.

WhatsApp sharing is user-initiated. The app cannot silently send a message through a personal WhatsApp account. Fully automated outbound delivery needs the official WhatsApp Business Platform, Meta business setup, approved templates where applicable, and securely stored server-side credentials.

GST registration, SAC/HSN codes, tax rates, place of supply, reverse-charge treatment and invoice particulars must be confirmed by the business's chartered accountant. This starter app is not a tax/accounting certification and does not replace TallyPrime.

## Shared cloud setup (one time per Supabase project)

1. Open the Supabase dashboard for your project and enable **Authentication → Sign In / Providers → Anonymous Sign-Ins**. No email provider or SMTP setup is required for this app's device pairing.
2. Open **SQL Editor**, paste/run the complete `cloud-sync-setup.sql` file once. The final query returns a 64-character random pairing code. Keep it private and save it somewhere secure.
3. On the first phone, import the old WashDesk backup if migrating existing local records, then open **Business settings → Shared Cloud Database** and pair using the code.
4. Enter the same pairing code once on every other authorised phone and Windows computer. Do not import the old backup again on those devices.
5. Confirm each device shows `Connected · live sync active on all paired devices`. Test by adding a harmless test customer on one device and confirming it appears on another, then remove the test customer.

Anonymous Supabase sessions are stored separately per device. If an app is uninstalled or its data is cleared, that device must be paired again using the saved code. Existing devices remain connected if one device is removed. The pairing code grants permission to join the business workspace; keep it private. Supabase Realtime is the primary low-latency channel and the app also performs a periodic reconciliation to recover updates missed while a device sleeps or briefly loses connectivity.

## Run locally
Serve this folder over localhost or HTTPS (service workers do not run from a plain file URL):

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages
The repository workflow at `.github/workflows/pages.yml` deploys the contents of this folder. In GitHub, open **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**, then check the Actions tab for the deployment result. When the workflow succeeds, the site will be available at the Pages URL shown in the deployment output.

Open the published HTTPS site on your Android phone and choose **Install app** or **Add to Home screen** in the browser. Each browser/device has its own local records; export and restore a backup when moving devices.


## Version 2.3.0 payroll calculation and safe Android install

- **Staff payroll:** The monthly payroll calculator uses the actual calendar-day count (28/29/30/31), subtracts one daily rate for every saved Absent day, then shows earned salary, salary already paid/adjusted, open staff advances and net payable. Unmarked dates are not counted as absent.
- **Advance handling:** Open advances appear as a proposed deduction in net payable. Saving a salary settlement confirms the adjustment and updates the advance register so the same advance is not deducted twice.
- **Android:** The 2.3.0 APK uses application ID `com.washdesk.carwash.v7`, allowing it to install beside the existing v6 app without replacing its local data or depending on the previous debug-signing key. After installing, connect it to the same Prime Auto Care shared cloud workspace using the existing pairing code. Do not import the same old backup again when the cloud workspace already contains the correct records.
- **Windows:** Install the 2.3.0 setup over the existing Windows app; its Electron user-data folder remains unchanged.


## Version 2.4.0 — staff controls, shift schedules and Prime Auto Care branding

- **Staff removal:** Removing an employee also removes that employee's daily attendance rows; old salary and advance entries remain in the financial audit history.
- **Individual attendance:** Each employee has an independent Present / Absent selector. Blank rows are left unchanged, Present can replace an earlier Absent entry, and a mistaken status can be cleared. Payroll uses the latest saved status for each date.
- **Shift timing:** Each employee has a separate schedule. The default is an 11-hour shift: 8:00 AM to 7:00 PM. Examples: 9:00 AM to 8:00 PM and 10:00 AM to 9:00 PM. The manager can change the start time and duration per employee.
- **Manager-only timing edits:** Shift changes require a 6-digit Manager PIN. The PIN is stored as a salted SHA-256 hash in shared settings and syncs to paired devices. Set it before staff use the app.
- **Branding:** Use the supplied Prime Auto Care wordmark for Android launcher / system launch icon, Windows installer and window icon, and PWA icons.
- **Responsive layout:** Attendance rows are easier to use on phones, payroll stays in a controlled horizontal scroll region, and laptop spacing is tuned for medium and wide screens.
- **Android:** This release uses application ID `com.washdesk.carwash.v8` so it installs beside v7 rather than overwriting its local app data.


## Version 2.5.1 audit fixes

- **Android launcher:** Adaptive icons now reference the generated Prime Auto Care foreground from the mipmap resource, instead of Capacitor's default drawable vector. Both standard and round launcher icons use the branded foreground.
- **Safe install:** Android application ID is now `com.washdesk.carwash.v10` because CI debug APKs are signed with an ephemeral key. This installs alongside v9 and preserves its local data. Keep the old app until the new one is paired and checked.
- **Cloud merge:** Staff attendance is explicitly included in the server-side per-record merge so devices updating different staff/date rows do not replace the entire attendance array.
- **Invoice numbers:** Paired online devices reserve numbers from the atomic PostgreSQL daily counter; a counter failure now blocks bill saving rather than guessing a local sequential number. Paired offline devices receive a visibly provisional `OFF` reference with a unique suffix. Online sequential numbering resumes when connected.
- **Device pairing:** There is no app-enforced four-device limit. Six concurrent mobile sessions are the intended target, but an actual six-device load test still must be run on the real devices and Supabase project.


## Version 2.5.2 — shared stock ledger and multi-device safeguards

- **Stock movements:** Each invoice sale, invoice cancellation, invoice item edit, stock purchase and manual stock adjustment creates a uniquely identified stock movement. The app derives current stock from the opening balance plus the movement ledger; it no longer syncs stock as a last-writer absolute quantity.
- **Server validation:** The shared workspace merge runs inside its existing locked PostgreSQL transaction, combines movements from all devices and rejects a transaction that would make shared stock negative. A rejected transaction remains local on its source device and is shown as a sync conflict; resolve the pending invoice or adjustment before syncing again.
- **Version gate:** The updated Cloud Sync SQL marks the server stock-ledger schema version. The app blocks shared invoice numbering and stock sync until it receives that server confirmation. Older paired clients are rejected by the updated SQL until they are updated to 2.5.2; update all paired phones and computers before resuming shared operations.
- **Migration:** Run the complete updated `cloud-sync-setup.sql` once in the existing Supabase SQL Editor. Existing product quantities become the opening stock baseline; existing historical invoices are not deducted again. The pairing code/workspace is retained.
- **Offline behavior:** Offline stock movements remain locally saved and merge when online. The server validates the combined movements when they arrive. Paired offline invoices continue to use clearly provisional `OFF` references; sequential shared invoice numbers require a confirmed online server counter.
- **Install:** Android uses `com.washdesk.carwash.v11` so it installs beside the 2.5.1 v10 APK and preserves its local storage. Keep previous builds until the new build has been paired and its cloud records verified.
- **Release validation:** CI builds and source-level regression tests are required. The actual six-device concurrent billing/stock test still must be completed on the user's devices; CI alone does not certify physical multi-device reliability.
