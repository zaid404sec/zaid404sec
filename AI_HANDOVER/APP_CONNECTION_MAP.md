# App connections and edit map

## Client-to-cloud

- The Android and web app compile the same client-side sources.
- car-wash-erp/src/cloud-sync.js creates the Supabase client using the project URL and publishable key. These values are client-safe by design; they are not service-role credentials.
- The owner pairs each device with the same workspace by entering the private setup pairing code. Anonymous Auth creates a per-device authenticated session.
- Business JSON snapshots are synchronized through washdesk_merge_sync. The primary payload is stored in public.washdesk_sync. Other server-side tables support workspace membership and shared invoice numbering.
- Never paste or publish the workspace pairing code. It allows a new device to join the business workspace.
- Google Business Profile credentials are not stored in the app bundle. The app calls Supabase Edge Functions using the authenticated session. Google OAuth tokens are encrypted server-side and Gemini runs server-side.

## Google Review data path

WashDesk Review Center → google-review-api → Google Business Profile APIs / Gemini → Supabase pac_google_* tables.

Google owner consent → google-review-oauth-callback → encrypted credentials.

Google Business Profile notification → Pub/Sub authenticated push → google-review-pubsub-webhook → google-review-worker → review sync → Supabase.

The scheduled worker is a recovery fallback. It does not publish AI replies.

## Important file locations

- Main UI/business logic: car-wash-erp/index.html
- Supabase client: car-wash-erp/src/cloud-sync.js
- Native WhatsApp/SMS links: car-wash-erp/src/native-links.js
- Communication client: car-wash-erp/src/communications.js
- Google Review function sources: car-wash-erp/supabase/functions/google-review-*/
- Google review migrations: car-wash-erp/supabase/migrations/20261117000100_google_reviews.sql and 20261118000100_google_review_pubsub.sql
- Initial business workspace SQL: car-wash-erp/cloud-sync-setup.sql
- Review worker fallback schedule: car-wash-erp/google-reviews-cron-setup.sql
- App validator: car-wash-erp/scripts/validate-app.mjs
- Android/Windows release workflow: .github/workflows/build-installers.yml
- Website workflow: .github/workflows/pages.yml

## Change and release procedure

Read AI_HANDOVER/SAFE_CHANGE_RULES.md. Work on a new branch from current main, make a small diff, add validator coverage, run npm run validate and PR CI, merge after tests pass, then verify a successful main release build and download the actual artifact. Update project state, release notes and complete source handover after every production release.
