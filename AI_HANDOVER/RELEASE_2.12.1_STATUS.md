# WashDesk 2.12.1 — Google setup and booking hardening

## Release status

- GitHub repository: https://github.com/zaid404sec/zaid404sec
- Merged into `main` through [PR #66](https://github.com/zaid404sec/zaid404sec/pull/66)
- Main release commit: `58c6d5bbd928caca955670f20a41ae3e9e7912ba`
- Main build: [run #287 — Android, Windows, backend checks and full release package passed](https://github.com/zaid404sec/zaid404sec/actions/runs/44466574563)
- App version: 2.12.1
- Android application ID: `com.washdesk.carwash.v24` (preserved)
- Supabase project: `jkjudmkqaebrgllemris`

## Changes in this release candidate

### Google Review Center setup wizard

- Reuses the existing WashDesk paired session and its scoped `google_reviews_admin` permission for setup actions; it does not ask for a second Supabase sign-in.
- Shows only boolean server-secret readiness flags; it never reads secret values back to the client.
- Shows the exact Google OAuth callback URL and a Copy action.
- Lets an authorised Google Reviews administrator save the numeric Google Cloud Project Number without changing workspace membership or the original Workspace Owner.
- Opens the Google OAuth consent page only after the server confirms that the OAuth Client ID, Client Secret, redirect URI and token encryption key are configured.
- Lists the exact Pub/Sub and OpenRouter server-secret names and links to the relevant consoles.
- Explains that a WashDesk device pairing code cannot replace the original Google Business Profile Owner's OAuth consent.
- Removes the legacy OpenRouter browser/localStorage key workflow. AI generation and daily draft generation use the server-side `OPENROUTER_API_KEY` only. The API key is not stored in the browser or sent in AI requests from the app.
- Keeps public auto-replies disabled by default and owner-controlled. Setup readiness is not equivalent to Google API approval or a successful real review sync.

### Booking improvements

- Vehicle categories: `Private Car / SUV`, `Taxi`, `Commercial Transport / Traveller`, `Auto Rickshaw`, `Other`.
- Pending booking rows have explicit Confirm and Reject actions.
- Rejected records store `rejected_at` and `rejected_by`; the rejection reason may be recorded in `status_note`.
- Only Pending requests can be Confirmed or Rejected. Server-side conditional updates prevent two paired devices from overwriting a booking after its status has changed.
- Rejected bookings are excluded from active slot occupancy, so the released slot can be requested again.
- The Rejected status is available in the status filter and uses a red status label.
- Existing atomic slot reservation and in-app booking-alert flow are retained.

## Database change

Migration `20261119080000_booking_rejected_status` is additive:
- Adds `rejected_at` and `rejected_by`.
- Extends the booking status constraint to include `rejected`.
- Adds a partial index for rejected bookings.
- Does not delete or reseed invoices, customers, vehicles, inventory, staff, finance or booking rows.

Production deployment completed on 19 November 2026:
- Applied migration `booking_rejected_status_20261119080000` (migration version `20261119053903`).
- Deployed `booking-api` v4 (ACTIVE) and `google-review-api` v8 (ACTIVE).
- Verified `pac_bookings.status` allows `rejected`, `rejected_at` and `rejected_by` exist, and the new status index exists.
- Verified bookings = 0, so no historical booking rows needed remapping.
- Verified RLS is enabled on `pac_booking_settings`, `pac_bookings`, `pac_booking_notification_events`, `pac_booking_notification_admins` and `pac_google_review_auto_reply_claims`; `anon` and `authenticated` have no SELECT permission; `service_role` can access them.
- Verified the original Workspace Owner ID is unchanged.

Live booking concurrency and notifications still require handset/browser tests using real customer attempts. No test booking was inserted into production.

## Google Business Profile setup — owner actions

Production activation status at the 19 November verification: API status `access_pending`; OAuth credential rows = 0; synced reviews = 0; Pub/Sub review events = 0; Google notifications = disabled; automatic replies = Off. Deploying the wizard/API is not the same as connecting the Google account.

The user-supplied `sk-or-v1` string is an OpenRouter AI key, not a Google Business Profile API credential. It was pasted into chat and must be treated as exposed:
1. Revoke that key in OpenRouter.
2. Create a replacement key.
3. Add the replacement only in Supabase Dashboard → Edge Functions → Secrets as `OPENROUTER_API_KEY`.

Do not put the replacement key into the APK, EXE, browser local storage, GitHub source, screenshots or chat.

Google Business Profile API activation still requires:
1. A verified, complete Business Profile that has been active for the required period and has the published business website listed on it.
2. A Google Cloud project and numeric Project Number.
3. Google's **Application for Basic API Access**, submitted by a GBP owner/manager account.
4. Google approval and enabling the seven Business Profile APIs.
5. A Google OAuth Web Client and the exact callback URI displayed by the WashDesk wizard.
6. Supabase Edge Function Secrets:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REDIRECT_URI`
   - `GOOGLE_TOKEN_ENCRYPTION_KEY` (Base64 of 32 random bytes)
7. Original Google Business Profile owner consent through the OAuth flow opened from WashDesk.
8. Cloud Pub/Sub topic, publisher permission for `mybusiness-api-pubsub@system.gserviceaccount.com`, authenticated push subscription/OIDC identity, and Supabase secrets:
   - `GOOGLE_REVIEW_WORKER_SECRET`
   - `GOOGLE_PUBSUB_TOPIC_NAME`
   - `GOOGLE_PUBSUB_AUDIENCE`
   - `GOOGLE_PUBSUB_PUSH_SERVICE_ACCOUNT`
9. Successful review sync and Pub/Sub test event before enabling automatic replies.

The exact steps are in `car-wash-erp/docs/GOOGLE_REVIEW_SETUP_GUIDE.md` and in the in-app Google Review Center Setup Wizard.

Google's official documents:
- https://developers.google.com/my-business/content/prereqs
- https://developers.google.com/my-business/content/basic-setup
- https://developers.google.com/my-business/content/notification-setup

Google approval and owner consent are external actions; source changes cannot bypass them. A pairing code authenticates the existing WashDesk workspace, not a Google Business Profile.

## Free AI limits

The default AI model route is `openrouter/free`. OpenRouter currently documents free-variant limits of 20 requests/minute and 50 requests/day for an account without qualifying credits; free providers and models can be unavailable or change. No one-second reply latency is promised.

## Website and booking-page 404 status

The main GitHub Pages workflow #77 successfully built and uploaded the site artifact but its deploy job failed (attempt 1 and the retry). The preceding run #76 failed in the same deploy stage. The public URLs are not confirmed live yet:
- https://zaid404sec.github.io/zaid404sec/website/
- https://zaid404sec.github.io/zaid404sec/website/booking/

Repository Pages Settings still must be verified:
**Repository → Settings → Pages → Build and deployment → Source = GitHub Actions**.

The connected GitHub tool can read the repository and create/merge source changes but does not expose an operation to change the Pages Source setting. Do not claim the website is live until the Pages deployment job succeeds and both URLs load.

## Notification limitations

The app polls the private booking alert queue while the app session is active and can show an Android local notification when notification permission is granted. Background push delivery when the app is closed needs additional push-provider credentials. WhatsApp alerts need configured Meta Cloud API credentials, a sender phone-number ID and an approved utility template; those are not created by the booking migration.

## Device QA and signing

CI validates app syntax, business calculations, booking portal JavaScript, Deno Edge Functions and the Android/Windows builds. CI is not a substitute for a real Android handset test. The APK keeps application ID `com.washdesk.carwash.v24`, but the signing certificate must match the installed APK before an in-place update. Sync and back up business data before replacing the installed build.

Test at minimum:
- Public booking page loads and lists only the new vehicle taxonomy.
- Two simultaneous customer requests for the last slot: one succeeds, the other receives slot-unavailable.
- Staff Confirm and Reject actions, rejection note, and slot release.
- Booking filters (dates, status, vehicle, service, urgent/normal, search).
- Paired-device alert and Android notification permission.
- Google wizard status, callback copy, original-owner OAuth, sync, Pub/Sub and moderation-state display after Google prerequisites are complete.
