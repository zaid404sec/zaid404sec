# Google Review AI — Deployment and verification checklist

Last verified: 18 November 2026.

## Current state

The Supabase project jkjudmkqaebrgllemris is active. The communications schema, Google Review schema, Pub/Sub event schema and messageRecipients sync merge migration were successfully applied and checked in Supabase. The Edge Function list was empty at last check. No OAuth credentials, Google review rows or Pub/Sub events were present in the new review tables.

Therefore the database model is deployed, including the new recipient-group sync collection, but the Google Review API, OAuth callback, worker and notification webhooks are not live yet.

## Function sources and endpoints

| Function folder | Endpoint suffix | Purpose |
| --- | --- | --- |
| google-review-api | /functions/v1/google-review-api | Owner-authenticated API and Gemini review workflows |
| google-review-oauth-callback | /functions/v1/google-review-oauth-callback | Google OAuth callback and encrypted token storage |
| google-review-worker | /functions/v1/google-review-worker | Secret-authenticated review sync worker |
| google-review-pubsub-webhook | /functions/v1/google-review-pubsub-webhook | OIDC-authenticated Pub/Sub push endpoint |

Full function URL base:
https://jkjudmkqaebrgllemris.supabase.co

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
3. Deploy google-review-api, google-review-oauth-callback, google-review-worker and google-review-pubsub-webhook using the Supabase CLI / deployment workflow.
4. Confirm all four functions appear in Supabase Dashboard → Edge Functions.
5. Connect the primary owner account from WashDesk Review Center.
6. Run a manual review sync. Verify Google reviews are inserted/updated and a success sync-log row is recorded.
7. Register notifications for the mapped location; configure the Pub/Sub topic/subscription and run a test push.
8. Confirm the webhook creates a deduplicated event row and invokes the worker.
9. Enable the optional four-hour worker fallback using google-reviews-cron-setup.sql only after worker secrets and Vault secrets are in place.

## Security rules

- OAuth refresh/access tokens are encrypted before storage using GOOGLE_TOKEN_ENCRYPTION_KEY.
- Service-role keys stay in Edge Function runtime, never in APK or frontend files.
- Webhook validates the Google-issued OIDC identity, audience, service-account email and expiry.
- Worker accepts only the configured worker secret.
- Google API function checks the signed-in Supabase user and workspace membership; owner-only actions require the workspace owner.
- AI response generation creates drafts. A human must approve before the public reply is posted.
- Do not store real credentials in GitHub source, docs, issue comments, screenshots or chat.
