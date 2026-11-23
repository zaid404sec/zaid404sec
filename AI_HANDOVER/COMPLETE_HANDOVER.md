## Current verified state — 21 November 2026

Prime Auto Care 2.14.2 is the single-Owner-login release candidate.

- Application version: 2.14.2; Android package ID `com.washdesk.carwash.v31`.
- Only the primary registered Owner email `bmumz3909@gmail.com` is accepted by the app login screen.
- One password is required. The same credentials provide full Owner permissions on each installation; there is no additional Owner device approval.
- The former second email has been demoted to Member and its booking-notification admin permission revoked.
- The legacy anonymous Owner identity has been demoted and its old Owner booking-device permission revoked. Its canonical snapshot UUID is intentionally preserved as the storage key.
- Both additive live Supabase migrations are recorded: `20261121102050_prime_auto_care_single_owner_login_20261121` and `20261121102515_disable_legacy_anonymous_owner_login_20261121`.
- No customer, vehicle, invoice, payment, stock, purchase, expense, staff, attendance, payroll, booking, website or booking-portal records were reset or deleted.
- New Supabase Auth password: pending update to the existing primary user; verify a real Auth password grant before reporting login success.
- Source: feature branch `fix/prime-auto-care-2.14.2-single-owner-login`; CI and release artifacts are pending.
- Android builds are debug-signed and side-by-side. Do not overwrite/uninstall the existing app until the new build is tested and a backup is verified.
- Public website and customer booking URLs are unchanged.

---

## Latest release candidate — Prime Auto Care 2.13.4

_Last updated: 20 November 2026 (Asia/Kolkata)_

### Public website URLs
- Business website: https://prime-auto-care-sigma.vercel.app/
- Customer booking website: https://prime-auto-care-sigma.vercel.app/booking/
- Both live routes were previously verified as HTTP 200 with `Content-Type: text/html; charset=utf-8`.
- Vercel project: `prime-auto-care`; project ID: `prj_TDEAylEd55OPJKN7oXgI7IoEFNAP`.
- Static website source: `car-wash-erp/website/index.html`.
- Static customer booking source: `car-wash-erp/website/booking/index.html`.
- Current Vercel Git auto-linking is not configured; the existing pages were deployed directly.

### Agreed device roles
Five active devices maximum, including the Owner Phone:
1. Owner Phone — full Owner authority.
2. Dad Phone 2 — booking alerts only.
3. Dad Phone 3 — booking alerts only.
4. Manager Phone 4 — booking alerts only.
5. Manager Laptop — booking alerts plus Accept/Reject only, after Owner approval.

The Owner remains the only administrator. The Manager Laptop is the one additional decision-capable device. It cannot Complete/Cancel a booking or change booking settings. Phones cannot Accept or Reject.

### New device access workflow
- Each new phone/laptop must first join the existing shared workspace using the private workspace pairing credential.
- The new device then sends a named device access request from Bookings.
- The Owner approves alerts-only access for phones.
- The Owner may grant Accept/Reject only to the Manager Laptop (Desktop device type).
- Maximum five active devices is enforced by the booking API.
- The Owner can revoke device access.
- The old 8-digit Generate/Authorise panel is not used. The chat-supplied `26102005` is not used as an authentication secret.
- Historical workspace member identities are retained; they are not automatically treated as approved devices by the new device allowlist.

### Release contents and source map
- `car-wash-erp/index.html`: main business app UI.
- `car-wash-erp/src/`: client modules, cloud sync, booking client, notification helpers, reports and native integrations.
- `car-wash-erp/supabase/functions/booking-api/index.ts`: authenticated booking, device access and status transition API.
- `car-wash-erp/supabase/migrations/`: database schema and additive migrations.
- `car-wash-erp/website/index.html`: public business website.
- `car-wash-erp/website/booking/index.html`: public customer booking page.
- `car-wash-erp/electron/`: Windows desktop app.
- `car-wash-erp/android/` and Capacitor config: Android packaging configuration and app ID.
- `.github/workflows/build-installers.yml`: CI builds Android APK, Windows installer, source, handover and checksums.
- `AI_HANDOVER/`: project state, architecture, migration history, setup and troubleshooting documentation.

### Database and backend
- Supabase project ref: `jkjudmkqaebrgllemris`.
- Workspace ID: `9cd6c212-f1fa-4758-bb5e-23758dabfaa7`.
- New additive migration: `20261120150000_owner_managed_five_device_booking_access.sql`.
- New table: `public.pac_booking_devices`.
- App/API must only be described as production-ready after the migration and matching Edge Function are both deployed and verified.
- Existing Owner identity, members, customers, invoices, bookings and business records must be preserved.
- Existing workspace pairing credential, Supabase service-role key, FCM credentials and Android signing key are not part of the handover package.

### Notification delivery limitations
- Realtime database events, app polling, Android local notifications and desktop notifications require the app/runtime to be active and permissions granted.
- Fully closed Android delivery still requires Firebase Cloud Messaging setup, secure server-side credentials, device tokens, a push sender and physical-device tests.
- Closed-browser desktop Web Push also needs VAPID keys and subscription setup.
- Do not promise SMS/WhatsApp delivery from this system without a configured provider and approved templates.

### Signing and installation caution
The repository CI workflow produces a debug-signed APK if no original release keystore is available. A debug APK with a different signing certificate cannot be installed as an in-place update over an existing signed app. Do not uninstall the working Owner application or overwrite local data until signing continuity and a safe migration are verified.

### Credentials and ownership
This handover documents architecture and account/service locations, not passwords. Email addresses supplied by the Owner are not written into the public repository. Confirm primary/recovery email assignment within the authenticated Owner account before enabling any email-based recovery. Never include passwords, 2FA codes, workspace join credentials, Supabase service keys, Google OAuth secrets, FCM service accounts or keystore passwords in ZIPs.

---


# Current verified state — 20 November 2026

This section supersedes older release/status notes below. Preserve the existing production workspace and original Workspace Owner.

- Current app release target: **WashDesk 2.13.1**, package ID `com.washdesk.carwash.v24`.
- Active development PR: [#68](https://github.com/zaid404sec/zaid404sec/pull/68), branch `feature/google-review-vault-pairing`.
- Complete CI run: [#445972](https://github.com/zaid404sec/zaid404sec/actions/runs/44597254275) — Android APK, Windows installer, Edge Function type-check and full release package all succeeded.
- Production Supabase project: `jkjudmkqaebrgllemris`, `ACTIVE_HEALTHY`, region `ap-northeast-2`.
- Active functions: `google-review-api` v10, `google-review-oauth-callback` v4, `google-review-worker` v6, `google-review-pubsub-webhook` v2, `booking-api` v10, `prime-auto-care-site` v3, `prime-auto-care-website` v2, `prime-auto-care-booking` v2, `public-reviews` v3.
- Public website: https://jkjudmkqaebrgllemris.supabase.co/functions/v1/prime-auto-care-site/
- Public booking page: https://jkjudmkqaebrgllemris.supabase.co/functions/v1/prime-auto-care-booking
- Booking creation and accept/reject/cancel status changes write notification events atomically. Four-phone pairing uses one-time owner-issued codes and independent per-device receipts. Paired devices receive Supabase Realtime events and the app refreshes the booking list without a full dashboard reload.
- Current database check: 34 workspace members, 1 non-owner notification admin plus the original Owner (2 authorised phones total), 0 unused pairing codes, 0 per-device receipts, 0 booking records and 0 notification events. Pair the other three signed-in phones from Bookings → Phone notification access.
- The 2.13.1 APK is a runner-generated debug build. Its signing certificate differs from the old 2.11.0 APK; Android will reject an in-place update. No original keystore was found. **Do not install over the existing v24 app.** See `AI_HANDOVER/ANDROID_SIGNING_STATUS.md`.
- App-active booking notifications use Realtime plus Android local notifications. Background delivery with the app fully closed still requires FCM setup.
- Google Basic API Access, original-owner OAuth consent, Pub/Sub/OIDC configuration and a replacement OpenRouter key remain external prerequisites. Auto-replies stay disabled. The OpenRouter key pasted in chat is compromised and must be revoked.
- GitHub Pages auto-deployment is manual-only. The Supabase Edge Function URLs above are the public source of truth.
- Migration recovery note: `AI_HANDOVER/MIGRATION_HISTORY_RECOVERY.md`. Do not run `supabase db push` until the remote/local migration ledger is reconciled.

---

# Prime Auto Care / WashDesk — Complete Technical Handover

Verified on 18 November 2026. This file is the continuity guide for future updates. Always re-check GitHub main, Supabase and external Google settings before making changes.

## 1. Project identity

- GitHub repository: https://github.com/zaid404sec/zaid404sec
- Default branch: main
- Application folder: car-wash-erp/
- Android app name: Prime Auto Care
- Current production release: 2.9.2, package ID com.washdesk.carwash.v24, main commit a8a4fb14f4219cd9fd9f8f1976ff8064c5ce134a.
- Release PR: https://github.com/zaid404sec/zaid404sec/pull/56 (merged).
- Main release build: https://github.com/zaid404sec/zaid404sec/actions/runs/44240836622 (Android, Windows and release-package jobs succeeded).
- The 2.9.2 Android package installs beside v23; it does not inherit v23-only local app storage. Keep v23 installed until the new app is paired with the same cloud workspace or restored from a verified backup.

## 2. Application architecture

The application is a mobile-first web application packaged as an Android app with Capacitor and a Windows desktop application with Electron.

| Responsibility | Source |
| --- | --- |
| Main UI, billing, dashboard and business rules | car-wash-erp/index.html |
| Project scripts and dependency versions | car-wash-erp/package.json |
| Android app ID and app name | car-wash-erp/capacitor.config.json |
| Android build and Windows installer CI | .github/workflows/build-installers.yml |
| GitHub Pages website deployment | .github/workflows/pages.yml |
| Supabase client, auth, pairing, sync and Realtime | car-wash-erp/src/cloud-sync.js |
| Shared workspace initial SQL | car-wash-erp/cloud-sync-setup.sql |
| Database migrations | car-wash-erp/supabase/migrations/ |
| Google Review Edge Functions | car-wash-erp/supabase/functions/google-review-*/ |
| Communications Edge Functions | car-wash-erp/supabase/functions/communication-*/ |
| WhatsApp / SMS / external app launch | car-wash-erp/src/native-links.js |
| Provider API queue client | car-wash-erp/src/communications.js |
| Native invoice PDF and file handling | car-wash-erp/src/invoice-native.js |
| Regression validator | car-wash-erp/scripts/validate-app.mjs |
| Offline service-worker shell | car-wash-erp/sw.js |
| Complete feature responsibility map | AI_HANDOVER/FEATURE_MAP.md |
| Mandatory data-safety rules | AI_HANDOVER/SAFE_CHANGE_RULES.md |

Do not replace the large index.html with a new app template. Read SAFE_CHANGE_RULES.md before editing any code or SQL.

## 3. Where the Android APK connects

The Android package includes a bundled copy of the application and its source modules. Its shared-cloud client is compiled from car-wash-erp/src/cloud-sync.js.

- Supabase project URL: https://jkjudmkqaebrgllemris.supabase.co
- Supabase project reference: jkjudmkqaebrgllemris
- Supabase region: ap-northeast-2 (Seoul)
- The app contains the Supabase project URL and a publishable client key. A publishable key is intended for client use and is not a service-role secret.
- A device creates an authenticated anonymous Supabase session, then joins the Prime Auto Care workspace with the private pairing code produced by the one-time cloud setup.
- Business records are persisted locally first and synchronized through the washdesk_merge_sync RPC into public.washdesk_sync. Workspace membership and invoice counters are stored in their own tables.
- Realtime is the main update channel; reconciliation is used as a recovery path.
- Google OAuth refresh tokens and Gemini secrets are not embedded in the APK. Google Review calls are made through Supabase Edge Functions.

Before switching from v23 to v24, keep the older app installed. Pair v24 with the existing workspace or restore a verified JSON backup. Check customers, vehicles, invoices, payments, staff, attendance, advances, expenses, stock and settings before retiring v23.

## 4. Supabase production state verified on 18 November 2026

Project jkjudmkqaebrgllemris was ACTIVE_HEALTHY on PostgreSQL 17. The following additive database migrations were applied and verified:

1. 20261112000100_communications_automation
2. 20261117000100_google_reviews
3. 20261118000100_google_review_pubsub
4. 20261118050000_add_message_recipients_sync_merge

The existing WashDesk core tables remain present, and the newly created pac_communication_* and pac_google_* tables have RLS enabled. The Google review settings, OAuth state/credential, review, AI analysis, reply-draft, sync-log and Pub/Sub event tables were verified in the project after migration. The fourth migration extends the existing washdesk_merge_sync(jsonb) function to merge the new messageRecipients collection; the existing workspace and sync snapshot were verified intact.

Important: the Supabase Edge Function list was empty at the same verification point. Database migrations are deployed; application Edge Functions and their secrets are not yet deployed/configured. Do not describe the Google Review system as live until the functions are deployed, secrets are set, owner OAuth succeeds, API access is approved, and a real review sync / push event has been verified.

## 5. Google Review AI architecture

The source includes these functions:

- google-review-api: authenticates the paired workspace owner/member, calls Google Business Profile APIs, manages review settings, sync actions, Gemini analysis and reply-draft actions.
- google-review-oauth-callback: receives Google's OAuth redirect, validates one-time state/PKCE, encrypts tokens and stores the owner's verified account.
- google-review-worker: refreshes reviews and records sync results using a private worker secret.
- google-review-pubsub-webhook: verifies a Google Pub/Sub OIDC push identity, deduplicates events and calls the review worker.

The AI design generates review analysis, management insights and response drafts. A human owner/manager must approve a reply before it is published. Never change this into automatic public replies without an explicit product decision and a clear approval flow.

### Required Supabase Edge Function secrets

Set these only in Supabase Dashboard → Edge Functions → Secrets. Do not put values in GitHub source, source ZIPs, APKs, EXEs, screenshots or chat.

| Secret | Purpose |
| --- | --- |
| GOOGLE_OAUTH_CLIENT_ID | Google OAuth web application client ID |
| GOOGLE_OAUTH_CLIENT_SECRET | Google OAuth web application secret |
| GOOGLE_OAUTH_REDIRECT_URI | Exact OAuth callback URL below |
| GOOGLE_TOKEN_ENCRYPTION_KEY | Base64 encoding of exactly 32 random bytes for AES-256-GCM |
| GEMINI_API_KEY | Google AI Studio / Gemini API key |
| GEMINI_MODEL | Optional model override; source has a default |
| GOOGLE_REVIEW_WORKER_SECRET | Long random secret shared by worker caller and worker |
| GOOGLE_PUBSUB_TOPIC_NAME | Full Google Cloud Pub/Sub topic resource name |
| GOOGLE_PUBSUB_AUDIENCE | Exact public Pub/Sub webhook URL |
| GOOGLE_PUBSUB_PUSH_SERVICE_ACCOUNT | Email of the service account used for authenticated push |

OAuth callback URL:
https://jkjudmkqaebrgllemris.supabase.co/functions/v1/google-review-oauth-callback

Pub/Sub push URL:
https://jkjudmkqaebrgllemris.supabase.co/functions/v1/google-review-pubsub-webhook

Worker URL:
https://jkjudmkqaebrgllemris.supabase.co/functions/v1/google-review-worker

The runtime also needs its built-in Supabase URL and privileged server key. Confirm these are present as Supabase-provided function environment variables; never copy a service-role key into the client app.

### GitHub Actions deployment secrets

The existing communications deployment workflow expects these repository Actions secrets:
- SUPABASE_ACCESS_TOKEN
- SUPABASE_PROJECT_REF
- SUPABASE_DB_PASSWORD

The project reference value is jkjudmkqaebrgllemris. The access token and database password must be created/retrieved by the owner and stored only in GitHub Actions Secrets. Do not send them to an AI chat or add them to the ZIP.

### Google Cloud and Pub/Sub setup

1. Create or select the Google Cloud project used for Business Profile API access.
2. Request Basic API Access and wait for Google's approval.
3. Enable the required Business Profile APIs after approval.
4. Create an OAuth 2.0 Web application client. Add the exact callback URL above as an authorised redirect URI.
5. Create Pub/Sub topic projects/GOOGLE_CLOUD_PROJECT_ID/topics/prime-auto-care-reviews.
6. Grant mybusiness-api-pubsub@system.gserviceaccount.com permission to publish to that topic.
7. Create an authenticated push subscription to the webhook URL. The Pub/Sub push service agent needs roles/iam.serviceAccountTokenCreator on the selected push service account.
8. Set the matching Pub/Sub audience and service-account email as Edge Function secrets.
9. Deploy the four Google Review Edge Functions from the corresponding folders. The API and OAuth callback authenticate their own requests; the worker uses GOOGLE_REVIEW_WORKER_SECRET; the webhook validates Google OIDC identity. Keep public function endpoints protected by their in-function authentication.
10. Connect the Google account from Review Center using the Business Profile owner account, then run manual Sync Reviews and verify data and sync logs.
11. Register Pub/Sub notifications only after Google API access, location mapping and OAuth are confirmed.
12. Set the optional four-hour fallback schedule only after worker secrets are configured. Use car-wash-erp/google-reviews-cron-setup.sql once, and create the two Vault secrets shown in that file.

## 6. Google Business Profile prerequisites and website

Business Profile ID recorded for the app: 13506481990772076097.
Recorded owner email: bmumz3909@gmail.com. Confirm this account is actually an Owner or Manager before OAuth and API application.

The expected website URL is:
https://zaid404sec.github.io/zaid404sec/website/

As of 18 November 2026, Pages run #67 (https://github.com/zaid404sec/zaid404sec/actions/runs/44240836667) completed the build and artifact-upload jobs successfully, but the deploy job failed. The public website URL has not been verified as live. In GitHub repository Settings → Pages, choose GitHub Actions as the build/deployment source, then rerun the Pages workflow. Do not claim deployment succeeded until the deploy job succeeds and the URL opens publicly.

After the website is publicly available, add its full HTTPS URL in the Google Business Profile editor under Edit profile → Contact → Website, and save. Verify the URL is visible on the public listing before requesting API access.

Google's official Business Profile API prerequisites state that the applicant must manage a verified Business Profile active for more than 60 days and have the business website listed on that profile. The API access request should be submitted using the Google Cloud project number and an email listed as an owner/manager. Google indicates API quotas of 0 QPM when not approved and 300 QPM when approved. See:
https://developers.google.com/my-business/content/prereqs
https://developers.google.com/my-business/content/basic-setup
https://support.google.com/business/answer/3039617

Google approval is an external decision. Code deployment cannot guarantee approval.

## 7. GitHub SSH access

Repository SSH remote:
git@github.com:zaid404sec/zaid404sec.git

HTTPS clone remote:
https://github.com/zaid404sec/zaid404sec.git

No SSH connection is used by the WashDesk Android app or by its Supabase database. SSH is only an optional way to access the GitHub source repository from a developer computer. Supabase API traffic uses HTTPS.

Generate a fresh Ed25519 key on the computer that will use GitHub:
ssh-keygen -t ed25519 -C "your GitHub account email"

Add only the public-key file (id_ed25519.pub) to GitHub → Settings → SSH and GPG keys → New SSH key. Test with:
ssh -T git@github.com

Then clone using the SSH remote above. The private key (id_ed25519) stays on that computer and must never be committed, uploaded, pasted into chat or included in this ZIP. This handover intentionally contains no private SSH key, password, API token, OAuth secret, database password or workspace pairing code. If the developer machine is replaced, create a new key on that machine and register its public key; do not copy an old private key into a shared archive.

## 8. Build, tests and release process

GitHub Actions workflow:
https://github.com/zaid404sec/zaid404sec/actions

Installer workflow:
.github/workflows/build-installers.yml

Website workflow:
.github/workflows/pages.yml

The installer workflow validates the app, builds the Android debug APK, builds a Windows NSIS installer, splits the large Windows installer into two auxiliary download parts, and packages source ZIP artifacts.

Required release checks:
- PR validation must pass.
- Merge the PR only after all checks pass.
- A new main-branch installer run must succeed after merge.
- Download the real APK and EXE artifacts from the main-branch run.
- Verify the APK opens as a valid APK/ZIP and run SHA-256 checks.
- Deliver the app source ZIP and complete repository handover ZIP.
- Update PROJECT_STATE.md and add a dated release note with the merge SHA, run URL, artifact IDs, sizes and hashes.
- Separate CI success from manual phone acceptance tests.

For app changes, preserve the existing live business data. Prefer additive, backwards-compatible migrations; never reset, drop, truncate or reseed production business tables.

## 9. Manual verification still required

- GitHub Pages website deploy and public URL.
- Add public website URL to the verified Google Business Profile.
- Google Basic API Access approval and quota check.
- Edge Function deployment and secret configuration.
- Owner OAuth connection to the actual Business Profile.
- Google review manual sync and a live Pub/Sub notification test.
- Actual handset check of v24 installation, shared cloud pairing, invoice PDFs, WhatsApp handoff, notifications and offline/online sync.
- Confirm Windows installer opens and existing user data remains present.

The source repository is the source of truth. This ZIP is a safe source and configuration handover, not a backup of production database contents or secrets.


## 2026-11-20 continuation checkpoint

This section records the verified state for continuing the Prime Auto Care WashDesk work without restarting.

### Source control
- Repository: `zaid404sec/zaid404sec`
- Production baseline: `main` commit `03191af76a703cb341eca88ac651bc331a935a32` (WashDesk 2.13).
- Active development: PR [#68](https://github.com/zaid404sec/zaid404sec/pull/68), branch `feature/google-review-vault-pairing`.
- Latest application-code commit: `fa1c1f029dd9eb67a235a061d5c8ffc5da0add05`. The handover-only checkpoint update follows on the same branch.
- Do not merge PR #68 until Android, Windows and Edge Function type-check workflows all pass. The latest run was still in progress when this checkpoint was written.

### Already merged in 2.13
- Half-day attendance deducts exactly 50% of the actual calendar-day salary rate.
- Dark Liquid Glass styling is applied to the main workspace and booking UI; printed invoices remain paper-white.
- Background Realtime snapshots no longer rebuild the active dashboard; refresh is user-controlled.
- Private Car, Private SUV, Taxi and Commercial Transport are distinct booking categories.
- Urgent booking field, pending/reject workflow, booking filters, and notification event/receipt schema are present.

### Latest development changes
- Google OAuth Client ID/Secret, redirect URI and token-encryption key are saved through paired-session, original-owner-checked Supabase Vault RPCs.
- Google AI provider key and internal Pub/Sub worker token use Vault-backed storage.
- OAuth callback, Google review worker and Pub/Sub webhook were updated to load workspace-scoped secrets server-side.
- Google reply publication status is re-read from Google and stored separately from the initial HTTP submission.
- Fixed Google setup validation to test the server-side Vault flow instead of expecting secret names in browser HTML.
- Fixed Pub/Sub bearer-token whitespace parsing and booking search whitespace normalization.
- Added owner-issued, one-time, 10-minute booking notification pairing codes and per-device notification receipts. Each phone now acknowledges its own alert; one phone's acknowledgement must not hide the event from other phones. This change is in PR #68 and must pass CI before merge.

### Supabase production state checked
- Existing project: `jkjudmkqaebrgllemris`, region `ap-northeast-2`, status `ACTIVE_HEALTHY`. Preserve this project and its existing Workspace Owner.
- Active Edge Functions: `google-review-api` v10, `google-review-oauth-callback` v4, `google-review-worker` v6, `google-review-pubsub-webhook` v2, `booking-api` v10, `prime-auto-care-website` v2, `prime-auto-care-booking` v2, `prime-auto-care-site` v3, and `public-reviews` v3.
- Public business website: https://jkjudmkqaebrgllemris.supabase.co/functions/v1/prime-auto-care-website
- Public customer booking page: https://jkjudmkqaebrgllemris.supabase.co/functions/v1/prime-auto-care-booking
- Booking settings are enabled for slug `prime-auto-care`, timezone `Asia/Kolkata`, 08:00–19:00, 30-minute slots, capacity 1, 14-day booking horizon.
- At the last read-only status check: 0 booking rows and 0 booking notification events. Do not create fake production bookings for testing.
- At the last read-only Google status check: 0 saved OAuth app configs, 0 owner OAuth connections, 0 OpenRouter Vault keys, 0 Pub/Sub worker secrets, and 0 enabled Google review notification settings. The setup wizard is deployed, but real Google credentials have not yet been supplied through it.

### External prerequisites and security
- Google Business Profile Basic API Access approval remains an external Google decision. Pairing-code authentication cannot bypass Google approval or the original owner's explicit Google OAuth consent.
- Google Pub/Sub topic, authenticated push subscription, OIDC service account and publisher/service-agent permissions must be configured in the Google Cloud project.
- Automatic Google replies remain disabled by default. Do not enable until API approval, owner OAuth, review sync, Pub/Sub and AI-key checks pass.
- An OpenRouter key was pasted into chat and must be treated as compromised. Revoke it and create a replacement; enter the replacement only in WashDesk Setup. Never add it to source, APK, logs, screenshots or this handover.
- Booking creation and status changes now create notification events atomically. Paired devices receive Supabase Realtime events plus fallback polling; Android local notifications require the app to be active and permission granted. Background delivery while fully closed still requires FCM registration and a server-side sender.
- The live Supabase website and booking Edge Functions are ACTIVE. GitHub Pages is not the public source of truth for these links; keep the Supabase links above in the app and Google Business Profile.

### Next exact steps
1. Finish CI for PR #68. Fix any new validator or build failure; do not bypass tests.
2. Deploy the latest booking API only after its Deno type-check passes.
3. Confirm the phone-pairing UI is visible; on the original Owner phone, generate one code per additional paired phone, then redeem each code on that phone. Test independent receipts across devices.
4. Complete the Google Review Center wizard from the original Workspace Owner account; save the Google OAuth Web Client, connect the Owner account, save a replacement OpenRouter key, and configure Pub/Sub.
5. Confirm Google Basic API Access approval and quota before attempting live review sync or reply publication.
6. Run a production-safe test using a controlled booking test only with explicit approval; verify no overlapping reservation can be created and notifications appear on every authorised device.
7. After all CI checks pass, merge PR #68, build the main-branch APK/EXE/source artifacts, verify SHA-256 hashes, and update the release handover with exact artifact IDs and checksums.


### Post-deployment update (2026-11-20)
- Deployed the latest booking API as `booking-api` v10 after the Deno Edge Function type-check passed.
- The v10 booking API now supports owner-generated one-time phone codes, per-device notification receipts, and independent acknowledgement. One phone no longer marks the same alert as read for every phone.
- The WashDesk Bookings page now includes the phone pairing panel. Generate a separate code on the Owner phone for each additional phone; each code expires after 10 minutes and can be redeemed once by an already-paired workspace member.
- Last live access count: 34 workspace members, 1 authorised booking-notification device, 0 unused pairing codes, 0 per-device receipts. The other two phones still need to be paired by their signed-in users.
- Latest complete CI run [#445954](https://github.com/zaid404sec/zaid404sec/actions/runs/44595450691) passed Android, Windows, Edge Function type-check and release packaging.

# Prime Auto Care 2.15.0 handover addendum (2026-11-23)

## Current release branch
- Branch: `prime-auto-care-2.15.0-stability-features`
- Target release: `2.15.0`
- Android application ID: `com.washdesk.carwash.v33` (side-by-side install, debug-signing unless production keystore is configured).
- Current primary Owner login remains `primeautoconsult@gmail.com`. No password is embedded in the app, repository or build.

## Implementation map
See `car-wash-erp/docs/RELEASE_2.15.0_STABILITY_FEATURES.md` for full release scope, source map, data safety and known external dependencies.

Primary code:
- `car-wash-erp/index.html`: invoices, vehicle-model input, multi-staff assignments, daily invoice status cards/filters, per-vehicle 4+1 scheme, booking completion-to-invoice, staff timekeeping and statements.
- `car-wash-erp/src/cloud-sync.js`: stable payload comparison, debounced latest-snapshot scheduling, Realtime-first sync and metadata-only 120-second fallback.
- `car-wash-erp/website/booking/index.html`: large public pending receipt and rapid duplicate-submit guard.
- `car-wash-erp/supabase/functions/booking-api/index.ts`: public duplicate-pending request guard.
- `car-wash-erp/supabase/functions/google-review-api/index.ts` and `google-review-oauth-callback/index.ts`: deployed role-based current Owner authorization mirrored into source.
- `car-wash-erp/scripts/validate-app.mjs`: 2.15.0 source / workflow assertions.

## Data safety
- Keep `washdesk_workspaces.owner_auth_user_id` at the existing canonical data owner UUID. Do not change it as part of a user-email/Owner-role change.
- Existing workspace membership records and the canonical `washdesk_sync` snapshot remain in place.
- The new invoice and attendance values are stored in the existing JSON sync payload; there is no schema migration for this release.
- Export a JSON backup before installing the new side-by-side APK.

## External dependencies not yet provisioned / verified
- Fully closed-app server push requires FCM, a Firebase Android app config, push notification plugin wiring and protected server credentials. The Local Notifications plugin alone cannot guarantee delivery after Android force-stops the app.
- WhatsApp Accept/Reject currently opens a prefilled compose screen. A human must review and press Send. Automatic sending and automatic PDF attachment require an approved WhatsApp Business Cloud API sender, templates and credentials. Booking decision PDFs are saved locally where the native file sharer is available.
- End-to-end validation still needs real Android and Windows devices, two active app installations, live public booking, invoice/PDF checks and WhatsApp confirmation.
- Never call the full release "fully verified" until those checks are completed.

## Build gate
The GitHub Actions workflow must pass the 2.15.0 validator, Android APK, Windows NSIS EXE, Edge Function type checks and full release packaging. The workflow artifacts—not local debug builds—are the release source of truth.

# Prime Auto Care 2.15.1 hotfix addendum (2026-11-23)

## Reported startup issue
The Owner login path could throw `ReferenceError: visibilityReconcileListener is not defined` during cloud sync startup.

## Fix applied
- `car-wash-erp/src/cloud-sync.js` now declares `let visibilityReconcileListener = null;` at module scope.
- The existing `startSafetyRefresh()` logic can safely remove and replace the one visibility-change handler.
- Realtime remains the primary cross-device sync route. The 120-second fallback still checks only `updated_at` before downloading the full workspace snapshot.
- The app validator explicitly asserts that the listener declaration exists.

## Build identifiers
- Version: `2.15.1`
- Android ID: `com.washdesk.carwash.v34`
- Service worker cache: `prime-auto-care-shell-v38`
- Side-by-side install; preserve the prior app and export a backup before device testing.

See `car-wash-erp/docs/RELEASE_2.15.1_VISIBILITY_LISTENER_HOTFIX.md` for the focused fix note. Do not claim real-device Owner login is verified until the user tests the rebuilt APK with the registered Owner password.
