# Google Review AI — Deployment and verification checklist

Last verified: 18 November 2026.

## Current state

The Supabase project jkjudmkqaebrgllemris is active. All six recorded migrations are applied, including `20261118082000_google_review_admins`. All seven deployed Edge Functions are ACTIVE. The Google Review API and OAuth callback are at version 2 after the 2.9.3 release deployment.

The production `pac_google_review_admins` table is server-only (RLS enabled, no authenticated policies, no anon/authenticated grants; service_role only). The v24 device has an active `google_reviews_admin` permission while its ordinary workspace role remains `member`. The original Workspace Owner identity remains unchanged.

The live review data check returned zero OAuth credential rows, zero synced reviews, zero Pub/Sub events, zero sync logs and zero notification settings enabled. Function deployment and device permission do not mean Google OAuth or review sync is operational. Google API access and OAuth secrets still need to be configured and verified.

## Function sources and endpoints

| Function folder | Endpoint suffix | Purpose |
| --- | --- | --- |
| google-review-api | /functions/v1/google-review-api | Workspace owner or explicitly scoped Google Reviews administrator API and Gemini review workflows (version 2) |
| google-review-oauth-callback | /functions/v1/google-review-oauth-callback | OAuth callback with a fresh scoped-permission check and encrypted token storage (version 2) |
| google-review-worker | /functions/v1/google-review-worker | Secret-authenticated review sync worker |
| google-review-pubsub-webhook | /functions/v1/google-review-pubsub-webhook | OIDC-authenticated Pub/Sub push endpoint |

Full function URL base:
https://jkjudmkqaebrgllemris.supabase.co

## v24 Google Reviews-only permission

The v24 member has been granted the single server-side permission `google_reviews_admin` in the existing Prime Auto Care workspace. This does not change the member's workspace role and does not grant access to billing, invoices, inventory, customers, staff or general workspace settings. The original Workspace Owner remains the same.

The permission migration is additive. Do not promote v24 to owner. To revoke this access, set `revoked_at` on the exact v24 row in `pac_google_review_admins`; do not delete the Workspace Owner or change workspace membership.

## Supabase secrets

Configure the required environment variables in Supabase Dashboard → Edge Functions → Secrets. The function code uses the following explicit names:

- GOOGLE_OAUTH_CLIENT_ID
- GOOGLE_OAUTH_CLIENT_SECRET
- GOOGLE_OAUTH_REDIRECT_URI
- GOOGLE_TOKEN_ENCRYPTION_KEY
- GEMINI_API_KEY
- GEMINI_MODEL (optional override)
- GOOGLE_REVIEW_WORKER_SECRET
- GOOGLE_PUBSUB_TOPIC_NAME
- GOOGLE_PUBSUB_AUDIENCE
- GOOGLE_PUBSUB_PUSH_SERVICE_ACCOUNT

Do not save actual values in this file or in any GitHub repository. Use a different random worker secret and encryption key for each production environment. The encryption key must decode from Base64 to exactly 32 bytes.

The callback URL must exactly match the Google OAuth client's authorised redirect URI:
https://jkjudmkqaebrgllemris.supabase.co/functions/v1/google-review-oauth-callback

## Google Cloud requirements

1. Use a Google Cloud project with a valid project number.
2. Meet Google's Business Profile API access criteria.
3. Submit the Basic API Access request from an account listed as a Business Profile owner/manager.
4. Confirm approval by checking the API quota in Cloud Console; Google documents 0 QPM as not approved and 300 QPM as approved.
5. Enable the Business Profile APIs and configure the OAuth consent/client.
6. Grant the Google Pub/Sub publisher service identity permission to publish to the chosen topic.
7. Create an authenticated push subscription, using a dedicated push service account and OIDC audience equal to the webhook URL.
8. Grant the Pub/Sub service agent permission to mint tokens for that push service account.

Official requirements:
- https://developers.google.com/my-business/content/prereqs
- https://developers.google.com/my-business/content/basic-setup
- https://developers.google.com/my-business/content/implement-oauth

Google's requirements currently include a verified Business Profile that has been active for 60+ days and a website representing the business listed on that profile. A successful OAuth consent does not override an unapproved API project; API calls can still return 403.

## Deployment sequence

1. Set GitHub Actions secrets SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD for the repository communications workflow.
2. Configure the Edge Function secrets listed above in Supabase.
3. Confirm google-review-api and google-review-oauth-callback are version 2; the other five functions remain deployed and active.
4. Configure the external Google Cloud/API, OAuth and required Supabase secrets listed above.
5. Connect the primary owner account from WashDesk Review Center using the already-authorised v24 device.
6. Run a manual review sync. Verify Google reviews are inserted/updated and a success sync-log row is recorded.
7. Register notifications for the mapped location; configure the Pub/Sub topic/subscription and run a test push.
8. Confirm the webhook creates a deduplicated event row and invokes the worker.
9. Enable the optional four-hour worker fallback using google-reviews-cron-setup.sql only after worker secrets and Vault secrets are in place.

## Security rules

- OAuth refresh/access tokens are encrypted before storage using GOOGLE_TOKEN_ENCRYPTION_KEY.
- Service-role keys stay in Edge Function runtime, never in APK or frontend files.
- Webhook validates the Google-issued OIDC identity, audience, service-account email and expiry.
- Worker accepts only the configured worker secret.
- The 2.9.3 candidate checks the signed-in Supabase user and workspace membership; Google Reviews administration requires either the original workspace owner or an explicit `google_reviews_admin` allowlist row. This does not grant billing, invoice, inventory or customer administration.
- The OAuth callback rechecks that the initiating device's Google Reviews permission remains active before saving tokens.
- The `pac_google_review_admins` table is server-only: no authenticated read/write policies or grants.
- The v24 membership remains `member`; do not promote it to `owner`.
- AI response generation creates drafts. A human must approve before the public reply is posted.
- Do not store real credentials in GitHub source, docs, issue comments, screenshots or chat.
