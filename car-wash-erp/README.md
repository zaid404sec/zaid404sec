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
- **Cloud sync:** The same Supabase workspace, one-time pairing code and server-side merge are retained. Do not disconnect Supabase. Remote snapshots are deferred on every active business module, open form and modal (not just New Bill), then applied after deliberate module navigation. Same-screen rerenders preserve scroll, navigation starts at the top, and cloud updates do not force a page reload or dismiss Android Gboard. Realtime is the primary update path; 30-second reconciliation is a recovery fallback. Online shared invoice numbers are reserved centrally before local stock is deducted.

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


## Version 2.5.2 — stability, branding and shared stock ledger

- **Android launcher:** Standard and round adaptive icons reference the branded Prime Auto Care foreground PNG from density-specific mipmap resources. The previous Capacitor template Android robot vector is not used. The logo is cropped and scaled to remain legible in launcher masks.
- **PWA and Windows branding:** The same cropped Prime Auto Care mark is generated for 192/512 PWA icons, Windows ICO, splash screen, Electron window and installer icon.
- **Safe install:** Android application ID is `com.washdesk.carwash.v11` because CI debug APKs use an ephemeral signing key. It installs beside the prior v9/v10 apps and does not read their Android local storage. Keep prior apps until the new app is paired and the cloud records are confirmed. The Windows installer keeps the existing Electron user-data folder.
- **Stability:** Remote workspace snapshots are deferred on all active business modules, open forms and modals. They are reconciled when the user navigates away. Same-screen rerenders preserve scroll; intentional module navigation starts at the top. The cashier input and Android keyboard are protected from background cloud renders. No forced page reload is used.
- **Local persistence:** Every normal save stops if local storage fails. The save handler restores the last persisted database snapshot. Invoice creation, cancellation, invoice edits, purchases and manual stock adjustments also have explicit rollback paths when the local write fails.
- **Stock movements:** Each invoice sale, invoice cancellation, invoice item edit, stock purchase and manual stock adjustment creates a uniquely identified stock movement. Current stock is derived from the opening balance plus all movement deltas; stale absolute product quantities are not the shared stock source.
- **Server validation:** The existing locked PostgreSQL workspace transaction combines stock movements from all devices and rejects any combined movement set that would make shared stock negative. The rejected payload remains saved locally on its source device and is shown as a stock conflict; correct the pending invoice/adjustment on that source device and tap Sync now.
- **Attendance:** Staff attendance is included in the SQL and client record merge so changes for different employees/dates are not lost by replacing the entire attendance array.
- **Invoice numbering:** Paired online devices reserve numbers using the atomic per-workspace/per-day PostgreSQL counter. If the shared counter fails, an online bill is not saved with a guessed local sequential number. Paired offline bills receive a visible provisional `OFF` reference with a unique suffix; this is deliberately not presented as a shared sequential number. Sequential numbering resumes when the device is online and the shared counter is available.
- **SQL version preflight:** Before a 2.5.2 client can write shared data or reserve an online invoice number, it calls the read-only `washdesk_get_stock_ledger_version` RPC. The SQL migration publishes version 1 only after the merge, invoice-counter and Realtime functions are defined and existing products have been seeded as opening stock. If the SQL update is missing or incomplete, the app blocks shared writes rather than sending new stock data to an old function.
- **Existing data migration:** The complete updated `cloud-sync-setup.sql` must be run once in the existing Supabase SQL Editor. It keeps the existing workspace and pairing code, sets each existing product's current cloud quantity as its opening balance, preserves existing stock movements if present, and does not deduct historical invoices a second time. Re-running the script is designed to be safe.
- **Device count:** There is no hard-coded four-device cap; the app supports pairing additional authorised phones/computers to the same workspace. CI does not prove a six-device physical load test. Simultaneous billing, inventory and sync must still be tested on all actual devices before relying on the six-device setup for live operations.

### Safe upgrade order for 2.5.2

1. On every currently installed version, reconnect each phone/laptop to the internet and confirm that it shows **Connected · all devices synced**. Resolve any pending cloud errors first.
2. Export a full backup from the current app and keep it outside the app. Since Android v11 installs separately, it cannot read v9/v10 local storage. Unsynced records on the old app will not automatically appear in v11.
3. Close the old app on every phone and computer. Do not leave v9/v10 clients running during the SQL migration.
4. In the existing Supabase project, run the **complete updated** `cloud-sync-setup.sql` once. Keep the existing pairing code private; the final query returns the same workspace pairing code.
5. Install Android 2.5.2 (v11) and the Windows 2.5.2 installer. Update every paired device to the same release before resuming shared billing or inventory work. Pair the new Android installations using the existing code; do not import the same backup on every device.
6. Confirm customer, invoice, attendance, inventory and payment records on the new installations. Test a harmless record from one device and verify it appears on the others. Keep the old app installations until these checks are complete.

### Messaging deliberately deferred to a later phase

The existing **Offers & WhatsApp → Share by WhatsApp** action remains available and opens the Android share menu for the user's existing WhatsApp account. The user chooses the destination and presses Send.

The following are planned, not implemented or enabled in 2.5.2: official WhatsApp Business Cloud API automatic bulk delivery; scheduled morning opening announcements; automatic invoice messages and PDF delivery; SMS gateway automation; and voice announcements. These require later provider onboarding, consent/templates and server-side credentials as applicable. No unofficial WhatsApp automation or silent personal-account sending is used in this release.


## Version 2.5.3 — WhatsApp Business share workflow

- Offers & WhatsApp now lets staff select opted-in customers, select all eligible contacts or clear the selection, compose one campaign message and optionally attach a promotional image.
- One Android share action opens the system share sheet; choose WhatsApp Business, then select the same intended recipients in WhatsApp and manually send. The app does not send automatically or bypass WhatsApp recipient controls.
- Existing invoice PDF sharing already prepares the customer-specific invoice message and PDF for the share sheet. The operator reviews the destination and sends.
- Official WhatsApp Cloud API automation, unattended bulk delivery, delivery receipts, scheduled opening announcements, SMS and voice automation remain future integrations. WhatsApp Business app activation alone does not provide Cloud API credentials or webhook access.
- No WhatsApp OTP, access token or Meta secret is stored in the app or repository.

## Version 2.5.4 — invoice share handoff and opening reminders

- **Customer-specific invoice handoff:** after a bill is safely saved, Android opens the system share sheet with the generated PDF attached and a prefilled customer-specific message containing invoice number, date, amount, paid balance and vehicle. The share title identifies the customer and saved mobile number so the operator can choose the correct WhatsApp Business chat. The invoice remains saved if the operator cancels the share. A saved customer mobile number is required for automatic share-sheet opening; otherwise use the invoice's Share PDF / WhatsApp action manually.
- **Daily opening reminder:** configure opening hours, business closing time, and a local reminder time in Business settings. Android schedules a repeating on-device notification. Tapping it opens Offers & WhatsApp with the opening message prepared. Each phone schedules its own reminder and must grant Android notification permission. This is a reminder, not an unattended message.
- **Manual SMS share:** the opening announcement can be passed to the Android share sheet; choose an SMS app and send manually.
- **Voice preview:** the announcement can be spoken on the current device using its speech engine. This is a local preview, not an automated phone call or voice message to customers.
- **WhatsApp Cloud API, automatic bulk delivery, delivery receipts, SMS gateway delivery and automated voice calls** remain pending provider onboarding and server credentials. The WhatsApp Business app registration by itself does not enable Cloud API sending.
- **Install:** Android application ID is `com.washdesk.carwash.v12`, keeping the prior v11 app installed separately. The Prime Auto Care launcher logo and Windows branding assets remain part of the build.


## Version 2.6.0 — queued WhatsApp, SMS and voice automation

### What the app adds

- **WhatsApp Cloud API:** recipient selection, consent checks, campaign scheduling, optional image media (requires an approved image-header template), customer-specific invoice PDF attachment, and delivery-status tracking through Meta webhooks.
- **SMS gateway:** queued and scheduled individual messages through Exotel's India SMS API using the exact registered DLT entity, sender header and template.
- **Automated voice calls:** queued outbound calls through Exotel using an approved 140/160 series caller ID, registered DLT voice script and an Exotel Flow URL. The Flow must read the call `CustomField` (Passthru) and speak the script. The current integration limits the rendered script to 120 characters.
- **Daily opening announcement:** a server-side schedule can enqueue WhatsApp, SMS and/or voice messages at the configured Asia/Kolkata time even when all phones are closed. It sends only to customers with consent for the selected channel.
- **Invoice automation:** after local invoice save, the app queues a PDF and customer-specific message for WhatsApp and/or an approved SMS invoice message, provided the customer has enabled the corresponding service-notification permission. If the provider is not configured, the app keeps the saved invoice and falls back to manual PDF sharing.
- **Queue and history:** jobs are queued centrally with per-recipient idempotency keys, retry limits, provider IDs and status events. The worker processes up to 25 jobs per minute and webhooks update accepted/sent/delivered/read/failed state.
- **Opt-out:** incoming WhatsApp and SMS STOP/UNSUBSCRIBE messages turn off that channel's marketing and service permissions in the shared customer record. An Exotel voice flow can also pass a digit-9 opt-out event to the callback.
- **Secrets:** Meta and Exotel access tokens, Supabase service credentials and worker secrets are read only by server-side Supabase Edge Functions. They are not included in the app bundle or Android APK.

### Critical distinction: WhatsApp Business app vs Cloud API

Having installed and registered the WhatsApp Business mobile app does **not** automatically activate the official WhatsApp Cloud API. Unattended sending requires the phone number to be onboarded in a Meta WhatsApp Business Account and a Cloud API Phone Number ID, WABA, access token, App Secret, webhook verification token and approved message templates. The API sender must be active and able to send from that number. Do not paste a Meta access token or OTP into the app, a GitHub issue or this chat.

### Provider onboarding required before unattended delivery

**1. Meta WhatsApp Cloud API**

- In Meta Business Portfolio / WhatsApp Manager, onboard the Prime Auto Care number for the Cloud API and verify that it is an API phone number (not only an app-only registration).
- Create a Meta app and a system-user access token with WhatsApp messaging permissions; keep the token server-side.
- Obtain the WABA ID and Phone Number ID.
- Create and receive approval for these templates (template names are configurable in the app):
  - Marketing text: `prime_auto_care_offer`, body variables `{{1}}` customer name and `{{2}}` approved campaign text.
  - Marketing image header: a separate image-header template name entered as the **Approved marketing image template**.
  - Invoice utility template: `prime_auto_care_invoice`, with a document header and seven body variables (customer, invoice number, date, total, paid, balance, vehicle).
  - Opening announcement template: `prime_auto_care_opening`, with five body variables (customer, business, opening time, closing time, location).
- In Meta Webhooks, set the callback URL to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/communication-webhook?provider=whatsapp`, use the same `META_WEBHOOK_VERIFY_TOKEN` as the verification token, and subscribe to the `messages` field so delivery statuses and inbound STOP replies reach the app.

**2. Exotel SMS and voice**

- Open an Exotel account for India and obtain its API Key, API Token and Account SID.
- Register Prime Auto Care as a Principal Entity on the DLT platform. Obtain the Entity/PE ID, approved sender header and separate approved promotional and service/invoice content-template IDs. Enter the exact approved template text; the app substitutes only the named variables.
- For voice, arrange the DLT-registered voice script/template and an Exotel Flow/voice app that reads the call's `CustomField` (Passthru) and plays the registered script. The current call payload is limited to 120 characters.
- Commercial voice calls must use a caller ID/CLI actually allocated and approved to the business in the applicable 140/160 series; the app's format check is not proof that Exotel has allocated or approved it.
- Configure Exotel delivery-status callbacks to the webhook URL generated by the queue. Configure the Exotel inbound SMS/opt-out callback to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/communication-webhook?provider=exotel&token=YOUR_EXOTEL_WEBHOOK_TOKEN`; the handler expects inbound `From` and `Body` fields for STOP processing.
- Obtain the customer's explicit channel-specific permission before marketing SMS or calls. Do not tick a consent box unless the customer really agreed.

**3. Add server secrets in Supabase**

Deploy the Supabase functions first (next section), then open **Supabase Dashboard → Project Settings → Edge Functions → Secrets** and add these values:

| Secret name | Value/source |
|---|---|
| `META_ACCESS_TOKEN` | Meta system-user / Cloud API access token |
| `META_APP_SECRET` | Meta app secret used to verify webhook signatures |
| `META_WEBHOOK_VERIFY_TOKEN` | A random verification phrase you create; also enter it in Meta Webhooks |
| `META_GRAPH_API_VERSION` | Current Graph API version enabled for your Meta app, e.g. `vXX.0` |
| `EXOTEL_API_KEY` | Exotel dashboard |
| `EXOTEL_API_TOKEN` | Exotel dashboard |
| `EXOTEL_WEBHOOK_TOKEN` | A long random secret used to authenticate Exotel callbacks |
| `PAC_WORKER_SECRET` | A long random secret; use the exact same value in Supabase Vault for the cron job |
| `PAC_CRON_SETUP_COMPLETE` | Set to `true` only after the one-minute Vault/pg_cron schedule is installed and verified |

Supabase supplies `SUPABASE_URL` and its service credentials to Edge Functions. The function also accepts the newer Supabase secret-key environment format if your project uses it. Do not put any of these values in `index.html`, `package.json`, the APK or the Windows EXE.

**4. Deploy the database migration and Edge Functions**

The repository includes `supabase/migrations/20261112000100_communications_automation.sql`, `supabase/functions/communication-api`, `communication-worker` and `communication-webhook`.

In GitHub, add these repository Actions secrets (not app environment variables):
- `SUPABASE_ACCESS_TOKEN` — a personal access token for the Supabase CLI.
- `SUPABASE_PROJECT_REF` — your existing project reference (the project URL is already configured in the app).
- `SUPABASE_DB_PASSWORD` — the project's database password.

Then open **GitHub → Actions → Deploy Prime Auto Care communications backend → Run workflow**. The workflow links to your existing Supabase project, runs `supabase db push`, and deploys the three Edge Functions. Check the workflow result before configuring the cron.

**5. Enable the one-minute server queue**

- After deployment, add the Supabase Vault entries `pac_project_url` and `pac_worker_secret`. The latter must be exactly the same random value as `PAC_WORKER_SECRET` in Edge Function Secrets.
- Run `communications-cron-setup.sql` once in the existing Supabase SQL Editor. It schedules `communication-worker` every minute through Supabase `pg_cron` and `pg_net`.
- Verify the row exists in `cron.job` and the function logs show successful worker invocations.
- Only then set `PAC_CRON_SETUP_COMPLETE=true` in Edge Function Secrets and redeploy/update the functions if needed. Until this is set, the app intentionally refuses to queue unattended sends.
- In the app, open **Offers & Messaging → Provider and automation setup**, save the non-secret Meta/Exotel/DLT IDs and templates, then use the status panel. Missing provider prerequisites are shown there.

### First live test

1. Add a test customer whose phone you control.
2. Capture and save that customer's explicit WhatsApp, SMS and/or voice consent.
3. Test a single WhatsApp template message first, then an invoice PDF, one DLT SMS and one voice call.
4. Check provider job IDs, delivery callback events and opt-out behavior before selecting more customers.
5. Confirm the daily opening schedule only after the test channels show ready.

### Delivery guarantees and remaining provider work

The queue is **at-least-once**, not a bank-style exactly-once transport: if a provider accepts a request but the connection drops before the worker receives the provider ID, a retry can cause a duplicate. Per-recipient idempotency prevents duplicate queue rows when users click twice, but it cannot make an external provider API transaction atomic with Supabase. Check the job history and test with one recipient before large campaigns.

Meta template approval, number/API onboarding, Exotel account activation, DLT registration, actual sender/caller-ID allocation, Exotel Flow authoring and Supabase secrets/cron deployment are external account steps. The APK contains the integration and setup controls, but unattended delivery is **not live until every required provider and server step above has been completed successfully**. Manual WhatsApp share, local daily reminder and on-device voice preview remain available independently.

 
## Version 2.6.1 — free WhatsApp workflow

- Free marketing delivery uses WhatsApp Business's built-in Broadcast Lists. The app selects only customers with explicit WhatsApp marketing consent, exports their contacts as a VCF file, and copies the campaign text. Import the VCF into Android Contacts and create a reusable Broadcast List in WhatsApp Business. WhatsApp sends one-to-many messages when the operator opens the saved list and presses Send.
- Broadcast recipients must save the Prime Auto Care WhatsApp Business number in their own phone contacts. Each list is limited to 256 contacts; use multiple lists for a larger audience. WhatsApp may impose monthly broadcast limits in some markets.
- **No automatic sends in free mode:** the app does not queue paid WhatsApp Cloud API, SMS gateway or voice campaigns. Those controls are hidden/disabled in the free Offers workflow. This avoids surprise charges.
- Daily opening reminder defaults to 7:00 AM and is stored locally on each phone. Android notification permission is required; tapping the reminder opens the prepared announcement. It does not send by itself.
- After an invoice is safely saved, the PDF is saved to Downloads / Prime Auto Care and the app opens the customer's direct WhatsApp chat using the saved mobile number and a prefilled message. The operator attaches the saved PDF and presses Send manually. The invoice is not sent automatically.
- Android uses app ID `com.washdesk.carwash.v14` so the new build can install beside v13. Previous app data is retained in the older installation until the new build is connected and checked.
- Paid WhatsApp Cloud API, SMS gateway, scheduled campaigns and outbound voice remain available only as future integrations after explicit cost approval and provider configuration.

 
## Version 2.6.2 — existing WhatsApp group and SIM SMS

- Replace the Broadcast List workflow with a group-post workflow. Compose the offer, optionally attach an image, and share it through Android's share menu. The operator chooses the existing Prime Auto Care WhatsApp group and presses Send. The app cannot preselect a group or send without that final action.
- WhatsApp groups support up to 1,024 members. Existing group members receive group posts without having to save the business number. This is not subject to the 256-contact Broadcast List cap.
- Business Settings stores the existing group invite link. The Customer profile offers **Invite to Prime Auto Care Group** when the saved group link exists and WhatsApp consent is recorded. It opens a one-to-one chat with a prefilled invitation; the customer must join or a group admin must add them manually. The app does not silently add people to a group.
- The invite link is sensitive: anyone who obtains it may be able to request to join, and it can be forwarded. Reset it in WhatsApp if it is shared unintentionally.
- Customer profiles provide a service thank-you SMS action and invoice details provide an invoice SMS action. Both require the customer's service-SMS consent and open the Android SIM SMS composer using the saved phone number and a prefilled message. The operator reviews and presses Send. The app does not hold SMS permissions or silently dispatch messages.
- SIM SMS has no gateway subscription, but the mobile operator may charge according to the SIM plan / SMS pack. This is not a universally free SMS service. For bulk/business A2P campaigns, check applicable TRAI DLT registration, sender header, content-template and consent requirements before sending.
- Android package ID is `com.washdesk.carwash.v15` (version 2.6.2), so this release installs separately from v14 until the new app is checked and paired. Offline cache is v18.
