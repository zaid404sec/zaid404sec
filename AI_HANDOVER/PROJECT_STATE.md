## Current verified state — 21 November 2026

Prime Auto Care 2.14.2 is being prepared with one permanent Owner sign-in.

- GitHub baseline before this change: `main` commit `e053208b11603816cfc9d8185304e4838d0888af` (2.14.1).
- Feature branch: `fix/prime-auto-care-2.14.2-single-owner-login`.
- Planned app version: 2.14.2; Android package ID: `com.washdesk.carwash.v31`; service-worker cache: v37.
- Single Owner email shown by the application: `bmumz3909@gmail.com`. The login screen has one fixed email field and one password field.
- The former secondary email is no longer on the app allowlist, is demoted to Member, and its booking-notification admin permission is revoked.
- The legacy anonymous canonical snapshot identity remains the data storage key, but its workspace role and old booking-device authority have been demoted/revoked. Do not change the canonical snapshot pointer or delete business data.
- Live Supabase migrations applied: `20261121102050_prime_auto_care_single_owner_login_20261121` and `20261121102515_disable_legacy_anonymous_owner_login_20261121`.
- The Auth password was not changed by the connected tools in this run. A generated replacement password must be set for the existing primary Auth user before claiming live password login works. Never embed it in source or APK.
- Owner login is designed to grant full Owner business and booking access on every installation with no separate Owner device approval. Staff workflows remain separately permissioned.
- The 2.14.2 CI build and live primary-password verification are still pending.
- Preserve the existing website and customer booking routes. No web deployment change is part of this app login patch.

---

## Latest release candidate — Prime Auto Care 2.13.4

_Last updated: 20 November 2026 (Asia/Kolkata)_

This section records the five-device access redesign being prepared for release. Do not reset the live workspace or customer/business records.

### Public websites — already live
- Business website: https://prime-auto-care-sigma.vercel.app/
- Customer booking page: https://prime-auto-care-sigma.vercel.app/booking/
- Both pages were previously fetched from Vercel with HTTP 200 and `Content-Type: text/html; charset=utf-8`.
- Website source: `car-wash-erp/website/index.html`; booking source: `car-wash-erp/website/booking/index.html`.
- Vercel project: `prime-auto-care`, project ID `prj_TDEAylEd55OPJKN7oXgI7IoEFNAP`.
- GitHub auto-linking is not configured; direct Vercel deployment was used for the existing public pages.

### Workspace and access model
- Supabase project: `jkjudmkqaebrgllemris`.
- Workspace: Prime Auto Care, ID `9cd6c212-f1fa-4758-bb5e-23758dabfaa7`.
- Preserve the canonical Owner identity and existing workspace membership.
- Existing 64-character workspace pairing credential remains the device's one-time workspace join credential. It must never be placed in source, ZIP files or public documentation.
- The 2.13.4 candidate adds Owner-approved device records with a maximum of five active devices including the Owner Phone.
- Intended devices: Owner Phone; Dad Phone 2; Dad Phone 3; Manager Phone 4; Manager Laptop.
- Phones are alert-only by default. The Owner may approve the Manager Laptop as the one additional device with Accept/Reject permission.
- The Owner Phone retains full administration and booking authority.
- The Manager Laptop is limited server-side to Accept and Reject. It cannot Complete/Cancel or change booking settings.
- Device requests must be paired to the workspace first, then approved in Bookings by the Owner. The Owner can revoke devices.
- No shared permanent 8-digit booking PIN is used. The number `26102005` shared in chat is not stored or used as a credential.

### API and migration
- Additive migration: `car-wash-erp/supabase/migrations/20261120150000_owner_managed_five_device_booking_access.sql`.
- New table: `public.pac_booking_devices`.
- The migration seeds the canonical Owner as the first active device and does not delete or rewrite historical workspace memberships or business records.
- New API actions: request, review and revoke booking-device access.
- Notifications and acknowledgements require an active authorised device.
- Status changes require Owner or approved Manager Laptop permission. The Manager Laptop can only confirm or reject.
- Per-device notification receipts remain independent.
- Migration and Edge Function deployment must complete before the 2.13.4 app is used in production.

### Notifications
- Android local notifications require app runtime and notification permission.
- Desktop browser/Electron notifications require app runtime and OS/browser notification permission.
- FCM background push for a fully closed Android app is not yet configured; do not claim it is operational until FCM credentials, token registration, sender and handset tests are complete.
- Desktop closed-browser push also needs Web Push subscription and VAPID credentials.
- SMS/WhatsApp are separate paid/provider integrations and are not part of this no-cost push implementation.

### Build and release
- Candidate source version: 2.13.4.
- Android application ID remains `com.washdesk.carwash.v24`.
- The CI Android APK is debug-signed by the runner unless the original production keystore is available. It is not safe to overwrite the currently installed Owner app with a differently signed APK.
- Use the repository's build workflow to produce the APK, Windows EXE, project source archive, complete repository handover and checksums.
- Verify the full workflow run and artifacts before distribution. A PR-only workflow run is a test build; merge/deploy state must be verified separately.
- Never package the original Android keystore, passwords, Supabase service-role key, FCM service account, OAuth secrets, workspace pairing credential or environment files.

### Source locations
- App UI: `car-wash-erp/index.html`
- Booking API client: `car-wash-erp/src/bookings.js`
- Booking API: `car-wash-erp/supabase/functions/booking-api/index.ts`
- Database migration: `car-wash-erp/supabase/migrations/20261120150000_owner_managed_five_device_booking_access.sql`
- Android/Electron packaging: `.github/workflows/build-installers.yml`
- Detailed device workflow: `AI_HANDOVER/BOOKING_NOTIFICATIONS.md`

---

# Current verified state — 20 November 2026

> This current-state section supersedes older historical status notes below. Preserve the existing data and original Workspace Owner.

## Source control and build
- Repository: https://github.com/zaid404sec/zaid404sec
- Production baseline: `main` commit `03191af76a703cb341eca88ac651bc331a935a32`, WashDesk 2.13.
- Active PR: [#68 — Google Review Vault pairing and booking fixes](https://github.com/zaid404sec/zaid404sec/pull/68).
- Current application-code commit: `39b2205860587b52cbadb5a1933e91c2ab497014` (WashDesk 2.13.1).
- Latest complete CI run: [Run #445972](https://github.com/zaid404sec/zaid404sec/actions/runs/44597254275); Android APK, Windows installer, Google/Booking Edge Function type-check, and full release packaging all passed.
- Main app package remains `com.washdesk.carwash.v24`.

## Production Supabase
- Project: `jkjudmkqaebrgllemris`, status `ACTIVE_HEALTHY`, region `ap-northeast-2`.
- Active functions: `google-review-api` v10, `google-review-oauth-callback` v4, `google-review-worker` v6, `google-review-pubsub-webhook` v2, `booking-api` v10, `prime-auto-care-website` v2, `prime-auto-care-booking` v2, `prime-auto-care-site` v3, `public-reviews` v3.
- Business website: https://jkjudmkqaebrgllemris.supabase.co/functions/v1/prime-auto-care-site/
- Public booking page: https://jkjudmkqaebrgllemris.supabase.co/functions/v1/prime-auto-care-booking
- Google Review Center's saved `website_url` already points to the Supabase business website, not GitHub Pages.

## Booking and notifications
- Public booking is enabled for `prime-auto-care`, Asia/Kolkata, 08:00–19:00, 30-minute slots, capacity 1, 14-day horizon.
- The booking database uses a per-workspace/per-day PostgreSQL advisory transaction lock and checks overlapping pending/confirmed/rescheduled bookings before insert. This prevents two simultaneous requests from claiming the same capacity slot.
- Booking API v10 supports owner-issued one-time phone pairing codes (8 digits, 10-minute expiry, single use) and per-device receipts. Acknowledging an alert on one phone does not clear it for other phones.
- Last database check: 34 paired workspace members, 1 non-owner notification admin plus the original Owner (2 authorised phones total), 0 unused pairing codes, 0 per-device receipts, 0 booking records and 0 booking notification events. Generate a separate code on the original Owner phone for each of the other two phones; each signed-in paired device redeems its own code.
- Booking creation and accept/reject/cancel status changes now create notification events atomically in PostgreSQL. Paired devices subscribe to Supabase Realtime with fallback polling. Android local notifications require the app to be active and permission granted; background delivery while fully closed still requires remote push/FCM.

## Google Reviews setup
- Vault-backed OAuth app config, OpenRouter key storage and Pub/Sub worker secret storage are implemented and deployed.
- Last database check: 0 OAuth app configs, 0 original-owner OAuth connections, 0 OpenRouter Vault keys, 0 Pub/Sub worker secrets and 0 enabled Google Review notification settings.
- Google Basic API Access approval, original-owner Google OAuth consent, Pub/Sub topic/subscription/OIDC configuration and a replacement AI key are still required. Auto-replies remain disabled by default.
- An OpenRouter key was exposed in chat. Revoke it and create a replacement; enter the replacement only through WashDesk Setup. Never commit or reuse the exposed key.

## 2.13.1 release baseline
- Half-day attendance salary deduction is exactly 50% of the calendar-day rate.
- Dark Liquid Glass app and booking UI are implemented; printed invoices remain paper-white.
- Dashboard automatic full reloads are reduced; manual refresh is available.
- Vehicle categories distinguish Private Car, Private SUV, Taxi and Commercial Transport.
- Android signing: the 2.13.1 debug APK certificate differs from the 2.11.0 APK certificate. Do not install it over the existing v24 app. No original keystore was found. See `AI_HANDOVER/ANDROID_SIGNING_STATUS.md`.
- Keep old source, APK, business records and existing owner identity intact. Never reset or reseed production data.

---

# Project state — Prime Auto Care / WashDesk

_Last verified: 19 November 2026_

## Current source of truth

| Item | Current verified value |
|---|---|
| GitHub repository | https://github.com/zaid404sec/zaid404sec |
| Default branch | `main` |
| Current main commit | `dd88813195b1c3de25e3afb36a9f116e77c85830` |
| Application folder | `car-wash-erp/` |
| App name | Prime Auto Care |
| App version | **2.11.0** |
| Android application ID | `com.washdesk.carwash.v24` |
| Capacitor | 8.x |
| Build environment | Node 22, Python 3.12, Java 21 |
| Release PR | [#58 — merged](https://github.com/zaid404sec/zaid404sec/pull/58) (scoped Google Reviews access) |
| Main release build | [Run #259 — Android, Windows, backend check and release packaging succeeded](https://github.com/zaid404sec/zaid404sec/actions/runs/44346528699) |
| Website deployment | [Pages run #75 — build succeeded, deployment failed](https://github.com/zaid404sec/zaid404sec/actions/runs/44346528672) |
| Supabase project | `jkjudmkqaebrgllemris` |
| Supabase project URL | https://jkjudmkqaebrgllemris.supabase.co |

The 2.11.0 Android APK retains package ID `com.washdesk.carwash.v24`. The CI workflow signs debug builds with a runner-generated key; package-ID continuity does not guarantee signature continuity. Do not uninstall v23 or v24, and do not overwrite the working v24 until the signing certificate matches and data continuity is checked.

## Version 2.9.2 release summary (historical)

The latest main-branch release is 2.11.0; see the successful GitHub Actions run #259 and the 2.11.0 release artifacts.

PR #56 added the Number & notification group manager under Offers & WhatsApp.

- Add, edit and remove named Indian mobile contacts.
- Validate ten-digit Indian mobile numbers and +91-prefixed numbers; prevent duplicate numbers.
- Assign one or more groups: Attendance, Expenses, Staff & payroll, Operations, Sales & bills, Inventory and Offers.
- "All contacts" includes every saved recipient.
- Prepare date-scoped attendance and business-expense messages. Personal/household expenses, salaries and staff advances are excluded from the business-expense summary.
- WhatsApp is manual and one-to-one. The owner reviews and presses Send; there is no silent WhatsApp broadcast or automatic group addition.
- Contact records are persisted in the app's existing database and synchronize through the WashDesk cloud merge path.

The production Supabase migration `20261118050000_add_message_recipients_sync_merge` is applied. It extends the existing `washdesk_merge_sync(jsonb)` collection list with `messageRecipients`; it does not reset the database or rewrite old business records.

## Product capabilities

- Customers, vehicles, service catalogue, price lists and visit history.
- Multi-line invoices, financial-year numbering, discounts, configured GST, partial payments, due balances, A4 PDFs and WhatsApp handoff.
- Inventory, stock movements, purchases, low-stock notices and consumable recipes.
- Staff directory, individual attendance, shifts/hours, salaries, advances and payroll reports.
- Daily/monthly reporting, CSV/Excel/PDF exports, dashboard analytics, backups and restore.
- Local reminder notifications, offline app shell, shared Supabase sync and WhatsApp offers.
- Google Review Center UI, AI analysis/copy generation, reply drafts and notification workflow source code. Live Google API integration is not yet operational; see the deployment state below.

## WashDesk 2.12.0 development candidate (not yet released)

The current feature branch is feature/washdesk-2.12.0-bookings-google-reviews and pull request #65. It extends 2.11.0 with persisted booking urgency, booking filters, private owner/paired-desk booking notifications, Android system alerts while the app is active, Google reply moderation-state tracking and a public Google reviews website feed. The paired v24 account remains a member and has a separate booking-notification permission; the original Workspace Owner is unchanged. It must not be treated as the current main release until PR #65 is merged and the main-branch APK/EXE/source artifacts pass verification.

Production-side additive migrations have been applied for booking urgency/notifications, foreign-key indexes, and the scoped paired booking-alert permission. The deployed booking API is version 2 (the candidate v24 alert-permission check still needs deployment after merge); Google Review API version 7, Google review worker version 4, and public-reviews feed version 1 are active. The v24 member has one active booking-notification grant and remains a member. Google OAuth credentials, synced reviews and Pub/Sub events are still zero; no auto-reply is enabled. WhatsApp booking alerts are not configured: booking settings default to in-app and there is no WhatsApp sender/recipient/template configuration on the workspace yet.

## Production Supabase database state

The existing project is ACTIVE_HEALTHY on PostgreSQL 17. The following additive migrations were successfully applied:

1. `20261112000100_communications_automation`
2. `20261117000100_google_reviews`
3. `20261118000100_google_review_pubsub`
4. `20261118050000_add_message_recipients_sync_merge`
5. `prime_auto_care_communications_automation_20261112`
6. `20261118082000_google_review_admins`

Verified after deployment:
- Existing `washdesk_sync` snapshot row still present.
- Existing Prime Auto Care workspace still present.
- 24 existing workspace-member records still present.
- New `pac_communication_*` and `pac_google_*` tables exist with RLS enabled.
- All seven deployed Edge Functions are ACTIVE; `google-review-api` and `google-review-oauth-callback` are version 2.
- `pac_google_review_admins` is active with no authenticated policies or grants; `anon` and `authenticated` have no access, and `service_role` is the only granted role.
- v24's ordinary workspace membership remains `member` and has one active `google_reviews_admin` permission. The original Workspace Owner record is unchanged.
- Google review tables still contain zero OAuth credential rows, synced review rows, Pub/Sub event rows and sync-log rows; no notification setting is enabled.
- Google review tables currently contain zero OAuth credential rows, synced review rows, Pub/Sub event rows and sync-log rows; no notification setting is enabled.
- A v24-specific Google Reviews admin change is under PR #58. Its additive migration and scoped grant are not yet applied to production.
- The server merge function contains `messageRecipients`.

Do not run setup SQL again as an update shortcut. Do not reset, drop, truncate or reseed production business tables.

## Remaining external activation work

| Workstream | Verified status | Required next action |
|---|---|---|
| Public website | Not live yet. Latest Pages run #67 built and uploaded the site, but its deploy job failed. | Repository Settings → Pages → Build and deployment → Source = GitHub Actions, then rerun the Pages workflow. Confirm the URL opens publicly. |
| Add website to Google Business Profile | Not verified / not done. | After the website is live, add https://zaid404sec.github.io/zaid404sec/website/ under Edit profile → Contact → Website. |
| Google Basic API Access | Approval not verified; no approved Cloud project/quota was seen. | Complete Google’s Basic API Access request using the Cloud project number and a GBP owner/manager account. Google approval is external. |
| Supabase Edge Functions | Seven functions are ACTIVE; Google Review API and OAuth callback are version 2. | Configure Google secrets and verify OAuth/API access. |
| Google OAuth | No OAuth credential rows are stored. | Configure the server secrets, then complete primary-owner OAuth after Google API access is approved. |
| Live review sync / alerts | No synced reviews, sync logs, Pub/Sub events or enabled notification settings. | Complete Google API access/OAuth and Pub/Sub configuration, then test sync and push delivery. |

Google's current prerequisites include managing a verified Business Profile that has been active for more than 60 days and having the business website listed on that profile. The applicant also needs the Google Cloud project number and must submit the Basic API Access application using an email listed as a Business Profile owner/manager. See https://developers.google.com/my-business/content/prereqs.

## Security and data continuity

- Client application uses the Supabase project URL and publishable key; these are not service-role credentials.
- Google OAuth tokens are designed to be encrypted server-side; service keys and Gemini keys must never enter the APK or frontend bundle.
- Never store a workspace pairing code, OAuth secret, Gemini key, database password, service-role key or private SSH key in GitHub source, ZIP files, screenshots or chat.
- Complete handover includes SSH setup instructions and repository remotes only. SSH private keys must be generated and kept on the developer's own device.
- Keep v23 installed while checking v24. Confirm same workspace pairing or restore a verified backup before moving business operations to v24.
- CI success is not manual Android handset testing. Verify PDFs/WhatsApp handoff, notification permissions, cloud sync after offline/online transitions and backup restoration on a real device.

## Release artifacts from main run #259 (current 2.11.0)

Workflow: https://github.com/zaid404sec/zaid404sec/actions/runs/44346528699

Workflow: https://github.com/zaid404sec/zaid404sec/actions/runs/44269802537

| Artifact | GitHub Actions artifact ID |
|---|---:|
| Android APK | `14445443985` |
| Windows installer | `14447435137` |
| Application source ZIP | `14446197184` |
| Complete repository / AI handover ZIP | `14445219150` |
| Combined APK + EXE + source + handover package | `14446242152` |

Artifact archives expire under GitHub's retention policy; download and keep a local copy. SHA-256 files are included inside the combined release package.

## Safe release process

Read `AI_HANDOVER/SAFE_CHANGE_RULES.md` before modifying anything. Work from current `main` on a feature branch, make a narrow diff, add regression coverage, pass PR validation, merge only after checks pass, then verify the main build and retrieve its actual artifacts. Update this document and the handover ZIP after each production release.

Historical 2.8.4 and earlier release notes remain in the repository for traceability; they are not the current app version.


---

## Current release update — Prime Auto Care 2.15.0 (23 November 2026)

Current application package is `2.15.0`, Android ID `com.washdesk.carwash.v33`. This release adds metadata-first cloud reconciliation, vehicle-model/multi-staff billing, invoice paid/pending/day summaries, public booking pending confirmation and duplicate guard, booking completion-to-invoice/payment flow, vehicle-specific fifth-visit reward controls, multi-stage staff attendance, overtime bonus payroll and advanced staff PDF. The canonical workspace data-owner key remains unchanged. See `AI_HANDOVER/RELEASE_2.15.0.md` for feature details, integration limitations and acceptance tests.

**Known integration prerequisites:** true Android push while fully closed still needs Firebase Cloud Messaging project setup, device tokens and a server sender. Automatic WhatsApp API delivery still needs Meta WhatsApp Cloud API credentials and approved templates; current flows prepare a PDF/message for the user to review and send.
