# WashDesk 2.11.0 — Release and deployment status

Last updated: 18 November 2026

## Release candidate

- Repository: https://github.com/zaid404sec/zaid404sec
- Release branch: \`feature/washdesk-2.11.0-bookings-review-ai\`
- Pull request: #64 (draft until the final release checks are reviewed)
- App version: 2.11.0
- Android application ID: \`com.washdesk.carwash.v24\` (retained from 2.10.x)
- Supabase project: \`jkjudmkqaebrgllemris\`
- Public site root: https://zaid404sec.github.io/zaid404sec/website/
- Public booking page: https://zaid404sec.github.io/zaid404sec/website/booking/

The source changes are additive. Do not reset or reseed the production database. The existing workspace, owner record, invoices, customers, vehicles, inventory, staff and finance records must remain intact.

## 2.11.0 changes

### Booking portal and WashDesk screen

- A public customer form collects customer name, mobile number, vehicle registration/category, requested service, date, available start time and optional notes.
- Supported categories: Private Car, Private SUV / 7-Seater, Taxi / Commercial, Transport / Traveller, Auto Rickshaw and Other.
- Service durations: Regular Wash, Foam Wash and Outside Wash = 30 minutes; Wax & Shine = 60 minutes.
- Default booking schedule: Asia/Kolkata, 08:00–19:00, 30-minute slots, one vehicle per slot, 14-day advance window.
- Public and staff-entered bookings are stored in new \`pac_bookings\` records. They do not alter invoices or the ordinary customer/vehicle tables.
- Public requests start in **Pending** status. The station must confirm a request before the customer travels to the service station.
- Staff can create urgent phone/walk-in bookings from the in-app Bookings screen.
- The server serializes booking requests per workspace/day and checks overlapping durations and bay capacity before inserting a booking.
- The current-day endpoint omits past slots; the database RPC also rejects a start time that has already passed.
- Public booking does not take a deposit or process a payment. No payment provider is configured.

### Google Review AI auto-reply

- A new owner-only setting controls event-driven AI replies. It is **Off by default**.
- Auto-publishing only considers the exact review resource named by a verified Pub/Sub NEW_REVIEW or UPDATED_REVIEW event. Routine/manual/scheduled full syncs do not auto-reply to historical reviews.
- Existing Google replies are not overwritten. The configured minimum rating is 5 stars by default; the original Workspace Owner may choose 4 or 5 stars.
- Reviews with complaint/negative-language indicators are held for human review.
- Reply claims are keyed by workspace and Google review resource to prevent duplicate publication on concurrent or redelivered events.
- OpenRouter is called only from the Supabase worker, using the server-side secret \`OPENROUTER_API_KEY\`. Never embed it in the APK, EXE, website JavaScript, GitHub source or this handover.
- AI-generated public replies are best-effort and are not guaranteed within one second. Google Pub/Sub delivery, AI inference and Google reply publication all introduce variable latency.
- AI marketing posts remain separate and approval-gated. This release does not automatically publish marketing posts.

## Production deployment verified on 18 November 2026

The following actions were completed against Supabase project \`jkjudmkqaebrgllemris\`:

- Applied additive migration \`20261118190000_prime_auto_care_bookings\`.
- Applied additive migration \`20261118193000_google_review_auto_reply\`.
- Deployed \`booking-api\` (ACTIVE, version 1, verify_jwt=false; the function performs its own signed-in workspace validation for staff actions).
- Deployed \`google-review-api\` (ACTIVE, version 5).
- Deployed \`google-review-worker\` (ACTIVE, version 3).
- The pre-existing OAuth callback and Pub/Sub webhook remain deployed.
- Confirmed \`pac_booking_settings\` has one Prime Auto Care workspace row: public slug \`prime-auto-care\`, Asia/Kolkata, 08:00–19:00, 30-minute slots, capacity 1 and 14-day horizon.
- Confirmed booking rows = 0 immediately after migration (no test/customer bookings were inserted).
- Confirmed RLS is enabled on \`pac_booking_settings\`, \`pac_bookings\` and \`pac_google_review_auto_reply_claims\`.
- Confirmed \`anon\` and \`authenticated\` have no SELECT permission on these tables; service_role has access.
- Confirmed \`auto_reply_enabled=false\` and \`auto_reply_min_rating=5\` after migration.
- Confirmed the Workspace Owner record remains present; no owner, member, invoice, customer, vehicle or other business records were changed by these deployment steps.

### Remaining server secret

The rotated OpenRouter key was not available to the deployment tool and the previous key was exposed in chat. Revoke the exposed key in OpenRouter and create a replacement. Add the new value in Supabase Dashboard → Edge Functions → Secrets as:

- \`OPENROUTER_API_KEY\`

Do not paste the replacement key into ChatGPT, GitHub, app settings, the release archive or the client. Auto-reply remains disabled until the original Workspace Owner enables it from Google Review Center.

Supabase secrets: https://supabase.com/dashboard/project/jkjudmkqaebrgllemris/functions/secrets

## Google Business Profile activation still required

The live database still had no OAuth credential rows, no synced Google reviews and no Pub/Sub review events when this release was deployed. Deployment of Edge Functions is not the same as a live Google connection.

Required external work:

1. Publish the business website and add its public URL to the PRIME AUTO CARE Google Business Profile.
2. Obtain Google Business Profile Basic API Access for the appropriate Google Cloud project.
3. Configure the Google OAuth web client and required Supabase server secrets.
4. Sign in with the original Google Business Profile owner account and complete OAuth consent.
5. Configure the Pub/Sub topic, publisher permissions and authenticated push subscription.
6. Run a manual review sync and verify that real reviews and sync logs appear.
7. Send a test Pub/Sub event and verify the worker processes the exact review resource.
8. Only after those checks, have the original Workspace Owner explicitly enable auto-replies.

Google approval, owner consent and Pub/Sub configuration are not actions the application can silently perform. Do not claim that Google review auto-publishing is live until a real test reply is confirmed in the Business Profile.

Relevant Google documentation:
- https://developers.google.com/my-business/content/prereqs
- https://developers.google.com/my-business/content/basic-setup
- https://developers.google.com/my-business/content/review-data
- https://developers.google.com/my-business/content/notification-setup

## GitHub Pages 404

The latest verified Pages workflow had successful build/upload steps but a failed deployment step. In the repository, open **Settings → Pages → Build and deployment** and set **Source = GitHub Actions**. Then rerun **Deploy WashDesk to GitHub Pages** and test both:

- https://zaid404sec.github.io/zaid404sec/website/
- https://zaid404sec.github.io/zaid404sec/website/booking/

After publication, the original Business Profile owner must add the website under Edit profile → Contact → Website.

GitHub Pages settings: https://github.com/zaid404sec/zaid404sec/settings/pages

## Android installation and data continuity

The Android application ID remains \`com.washdesk.carwash.v24\`, which is necessary for an update path from 2.10.x. It does not, by itself, guarantee Android will accept an in-place installation: the signing certificate must also match. The existing CI creates debug artifacts and signing-certificate continuity must be checked on the actual device.

Before replacing the current APK:
- Confirm the existing app is paired with the same Prime Auto Care cloud workspace.
- Complete a current cloud sync and a verified backup.
- Do not uninstall the old app merely to get around a signature mismatch until local data is backed up and restored successfully.
- Test invoices/PDF sharing, staff screens, booking creation, offline/online sync and Android notifications on the actual handset.

## Release QA status

The GitHub Actions release workflow checks:
- Main app JavaScript syntax and business calculations.
- Customer booking page inline JavaScript syntax.
- Android APK build.
- Deno type checks for Google Review API, OAuth callback, worker, Pub/Sub webhook and booking API.
- Windows installer build and full source/handover/release package assembly.

CI success does not replace a real-device test, a live customer booking, Google API approval or a real Google reply publication test.
