# WashDesk 2.12.0 — implementation and activation status

_Last updated: 19 November 2026_

## Release candidate
- Repository: https://github.com/zaid404sec/zaid404sec
- Branch: feature/washdesk-2.12.0-bookings-google-reviews
- Base: main commit dd88813195b1c3de25e3afb36a9f116e77c85830 (WashDesk 2.11.0)
- Application version: 2.12.0
- Android application ID: com.washdesk.carwash.v24
- Supabase project: jkjudmkqaebrgllemris
- Public website: https://zaid404sec.github.io/zaid404sec/website/
- Customer booking page: https://zaid404sec.github.io/zaid404sec/website/booking/

This is a feature-branch candidate, not a released APK. Do not replace a working installed app until the CI artifact is downloaded and tested, and its Android signing certificate matches the installed app.

## Implemented in the candidate

### Booking workflow
- Added pac_bookings.is_urgent and a service-role-only atomic wrapper around the existing booking-slot transaction. The original slot reservation RPC remains unchanged.
- Added customer urgent-request checkbox and staff-created urgent booking checkbox.
- Added filters: date range, status, vehicle type, service type, urgent/normal, and text search across booking reference, customer name, mobile and vehicle registration.
- Added private pac_booking_notification_events with idempotency by workspace/booking/event.
- The paired original Workspace Owner device polls for unread booking events and displays customer, contact, vehicle, service, date/time, source and urgency. Only the original owner can read/acknowledge alerts.
- Added owner-configurable optional WhatsApp alert destination and approved template name. Messages queue through the existing communications worker only when the WhatsApp sender, server credentials and an approved utility template are configured. The event remains in-app even without WhatsApp configuration.
- Public bookings remain Pending until staff confirms them. Urgency does not override opening hours, bay capacity, slot conflicts or server validation.
- Payment/deposit processing is not included.

### Google review publication status
- Added database columns to track Google reviewReplyState, policy violation and last checked time for both synced reviews and reply drafts.
- Both the event-driven AI worker and manual reply approval path now re-fetch the review after submitting a reply and record the output-only moderation state.
- The Review Center displays a moderation-state column. A successful Google updateReply response is reported as submitted, not assumed to be publicly approved.
- Subsequent Pub/Sub or reconciliation syncs refresh the stored moderation state.
- The auto-reply feature remains OFF until original Workspace Owner opt-in and successful Google/Pub/Sub activation.

### Public website
- Added a privacy-limited public Google reviews feed. It returns only real synced reviews and displays business replies only when Google reports APPROVED.
- No sample or fabricated reviews are inserted. The page shows an empty-state explanation until Google API access and sync are enabled.
- Existing booking portal and business site are retained. No second Pages deployment workflow was added.

## Production database change

The additive migration 20261119034723_booking_urgency_notifications_google_publication is applied and appears in the live Supabase migration history. It adds the booking urgency column, owner notification settings/event table, safe RPC wrapper, and Google moderation-state columns. The production database was not reset or reseeded. The existing Workspace Owner and historic business records were preserved.

The public public-reviews Edge Function is deployed ACTIVE (version 1, verify_jwt=false) and serves only the limited public review feed. The booking API, worker and Google API changes in this branch still require CI validation and release deployment before they are considered the active app backend.

## Booking alert configuration

- In-app notification: enabled by default via private events and owner-only polling in the app.
- WhatsApp alert: owner must select WhatsApp in Booking Settings, enter the owner mobile number and the exact approved Meta utility template name.
- Existing server-side messaging requirements remain: META_ACCESS_TOKEN, META_GRAPH_API_VERSION, and configured WhatsApp Phone Number ID. Meta must have approved the selected template with the two body variables used by the existing communications worker.
- A queued WhatsApp job is not proof of delivery; provider status is tracked by the existing communications system.

## Google Business Profile activation — not complete

Live database audit at the start of this work showed zero Google OAuth credential rows, zero synced reviews, zero Pub/Sub events, and no enabled notifications/auto-replies. The pairing-code flow connects an app device to the existing Supabase workspace; it does not replace Google OAuth consent.

Required owner/provider actions:
1. Ensure the Business Profile is verified/eligible and the business website is publicly reachable and listed on the Profile.
2. Apply for Google Business Profile Basic API Access using the numeric Google Cloud Project Number and a Google account listed as a Business Profile owner/manager. Approval is external to this code.
3. Configure Google OAuth Web client and server-side Supabase secrets, then complete OAuth with the original Business Profile Owner (scope: https://www.googleapis.com/auth/business.manage).
4. Create Cloud Pub/Sub topic; grant mybusiness-api-pubsub@system.gserviceaccount.com Publisher on it; create authenticated push subscription to the Supabase Pub/Sub webhook; configure the topic name/OIDC audience/service account secrets.
5. Revoke the API key exposed in the earlier chat. Add a newly generated OPENROUTER_API_KEY only in Supabase Project Settings → Edge Functions → Secrets. Never paste the replacement key into ChatGPT, GitHub, app settings or the ZIP.
6. Run manual sync, verify real reviews and sync logs, send a Pub/Sub test, then let the original Workspace Owner opt in to auto-replies.

Google moderation values are PENDING, APPROVED and REJECTED; an HTTP 200 response from updateReply alone does not prove a public reply is live. A review can remain Pending while Google moderates it.

## Website deployment — not yet verified

The existing .github/workflows/pages.yml publishes the full car-wash-erp/ folder. The 2.11.0 Pages run #75 build/upload job succeeded but the deployment job failed; logs were unavailable, so the precise failure was not proven. The workflow now uses the upload-pages-artifact v4 action.

Owner must open https://github.com/zaid404sec/zaid404sec/settings/pages and set Build and deployment → Source = GitHub Actions. Then merge the passing PR and check the new Pages run. Verify both public website and booking links from a phone. After that, the original Business Profile Owner must add the live URL under Edit profile → Contact → Website.

## QA / release gates

- Run npm run validate in car-wash-erp/.
- Deno type-check all five Google/booking/public feed Edge Functions.
- CI Android APK, Windows EXE, backend type check, source ZIP and full release packaging must all succeed.
- Run actual booking tests (public and staff), urgent flag persistence, date/status/search filters, slot conflict handling, owner notification and WhatsApp provider delivery when configured.
- Test review reply submission with a real Google test review and verify PENDING then APPROVED/REJECTED state after subsequent sync.
- Verify website deployment and public booking page from a phone.
- Do not claim one-second Google public reply; Pub/Sub, AI inference and Google moderation have variable latency.

## Signing warning

The current Android workflow uses assembleDebug with CI-generated debug signing, not a persistent release keystore. A successful debug APK build does not prove signing-certificate continuity with the installed v24 app. Do not uninstall the existing app or overwrite its local data. A stable signed update requires the owner's existing keystore and passwords to be configured as protected GitHub Actions secrets, or an intentional, backed-up signing migration.
