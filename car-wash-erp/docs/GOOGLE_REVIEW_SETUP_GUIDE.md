# Prime Auto Care — Google Review Center setup guide

This guide is for the WashDesk 2.13 app and the existing Prime Auto Care Supabase project.

## The important distinction

Google Business Profile API access and AI text generation are two different services:

- **Google Business Profile API** lets WashDesk retrieve reviews, monitor review changes and publish business replies. Google must approve the Cloud project for Basic API Access. No app or pairing code can bypass that approval.
- **OpenRouter** supplies the AI model used to draft replies and marketing content. It does not grant Google Business Profile access.

The OpenRouter key previously pasted into this chat is exposed. Revoke it in OpenRouter and create a replacement. Do not paste the replacement into this chat, a GitHub file, an APK or a screenshot. Enter it only in the WashDesk Setup wizard described below.

## Public Prime Auto Care links

The public pages are served by the existing Supabase project so they do not depend on GitHub Pages deployment settings:

- Business website: <https://jkjudmkqaebrgllemris.supabase.co/functions/v1/prime-auto-care-website>
- Customer booking page: <https://jkjudmkqaebrgllemris.supabase.co/functions/v1/prime-auto-care-booking>

Use the business website URL in Google Business Profile under **Edit profile → Contact → Website**. Use the booking URL in WhatsApp, invoices and the WashDesk Bookings page.

## 1. Confirm Google Business Profile eligibility

Sign in to <https://business.google.com/> using the Google account that owns or manages PRIME AUTO CARE.

Google's current prerequisites include a verified Business Profile that has been active for more than 60 days, plus an official business website listed on the profile. Keep the profile details complete and current: <https://developers.google.com/my-business/content/prereqs>.

## 2. Create the Google Cloud project and request Basic API Access

1. Open <https://console.cloud.google.com/>.
2. Create or select a project for Prime Auto Care.
3. Open the project's Dashboard and copy its numeric **Project Number** (not the project name or Project ID).
4. In WashDesk, open **Google Review Center → Setup wizard**.
5. Paste the numeric Project Number into **Google Cloud Project Number** and save it.
6. Open Google's prerequisites page and submit the **Application for Basic API Access** for this same project: <https://developers.google.com/my-business/content/prereqs>.
7. Use an email address that is an owner or manager of the Prime Auto Care Business Profile.
8. Wait for Google's approval email.

To check approval, open Google Cloud Console → APIs & Services → Enabled APIs & services → Quotas. Google's documentation says 0 QPM means API access has not been granted; 300 QPM indicates the standard approved quota. Do not repeatedly request a quota increase while the project remains unapproved.

## 3. Enable the seven Business Profile APIs

After Basic API Access is approved, enable the seven APIs listed in Google's official Basic setup guide:

1. Google My Business API
2. My Business Account Management API
3. My Business Lodging API
4. My Business Place Actions API
5. My Business Notifications API
6. My Business Verifications API
7. My Business Business Information API

Official guide: <https://developers.google.com/my-business/content/basic-setup>.

## 4. Create the Google OAuth Web Client

1. Open <https://console.cloud.google.com/auth/clients>.
2. Create an OAuth client with application type **Web application**.
3. In WashDesk → Google Review Center → Setup wizard, copy the exact **Authorised redirect URI** displayed in the Google OAuth section.
4. Add that exact URI to the OAuth Web Client's **Authorised redirect URIs**.
5. Copy the OAuth **Client ID** and **Client Secret**.
6. Return to WashDesk → Setup wizard and paste both into **OAuth Client ID** and **OAuth Client Secret**.
7. Press **Save OAuth client securely**.

WashDesk stores these credentials and its generated AES-256 token-encryption key in Supabase Vault. You do not need to open Supabase Edge Function Secrets or run SQL manually for the OAuth credentials.

OAuth still requires one explicit Google consent from the original Business Profile Owner. WashDesk never asks for the Google password inside the app. Official OAuth guide: <https://developers.google.com/my-business/content/implement-oauth>.

## 5. Connect the original Business Profile Owner

1. Ensure the account email shown in Google Review Center is the account that owns the Prime Auto Care Business Profile.
2. Press **Connect Google Owner Account**.
3. In the official Google consent screen, sign in to the original Business Profile Owner account.
4. Review and approve the Business Profile access request.
5. Return to WashDesk. The setup status should show **Google Owner OAuth — Ready**.
6. Press **Sync reviews** and confirm the review count and last successful sync timestamp.

This Google consent is separate from the existing WashDesk device pairing. Pairing authenticates a phone to your Prime Auto Care workspace; Google consent authorises the app to access the Business Profile.

## 6. Save the OpenRouter AI key

1. Open <https://openrouter.ai/keys> and create a replacement key.
2. In WashDesk → Google Review Center → Setup wizard, paste it into **Replacement OpenRouter API key**.
3. Press **Save AI key securely**.
4. The field clears after saving. The key is stored in Supabase Vault and is not returned to the app.

WashDesk uses the `openrouter/free` model route. OpenRouter currently documents 20 requests per minute and 50 requests per day for free-variant accounts without qualifying credits; provider/model availability can change. See <https://openrouter.ai/collections/free-models>.

## 7. Configure Google Pub/Sub review notifications

Pub/Sub is Google's mechanism for delivering new and updated review events. Set it up once in the same Google Cloud project:

1. Open <https://console.cloud.google.com/cloudpubsub>.
2. Create a topic named `prime-auto-care-reviews`.
3. Copy the complete topic resource name, for example `projects/PROJECT_ID/topics/prime-auto-care-reviews`.
4. Grant `mybusiness-api-pubsub@system.gserviceaccount.com` the **Pub/Sub Publisher** role on that topic.
5. Create a dedicated Google Cloud service account for authenticated push delivery, for example `prime-auto-care-push@PROJECT_ID.iam.gserviceaccount.com`.
6. Create a **Push** subscription for the topic.
7. Use the exact **Authenticated push URL / OIDC audience** shown in WashDesk → Setup wizard for both the push endpoint and the OIDC audience.
8. Enable authentication and select the dedicated push service account.
9. Grant the Pub/Sub service agent `service-PROJECT_NUMBER@gcp-sa-pubsub.iam.gserviceaccount.com` the **Service Account Token Creator** role on the push service account. The user creating the subscription also needs permission to attach that service account (the `iam.serviceAccounts.actAs` permission, commonly granted through Service Account User).

Google's official notification guide: <https://developers.google.com/my-business/content/notification-setup>. Google's authenticated push guide: <https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions>.

10. Copy the full topic resource name and push service-account email into WashDesk → Setup wizard → **Instant Google review notifications (Pub/Sub)**.
11. Press **Save Pub/Sub settings securely**. WashDesk generates its internal worker token and stores it in Supabase Vault; you do not create or paste that internal token.
12. Press **Enable Google review alerts**. WashDesk registers the topic with the Google Business Profile account.
13. When a new review arrives, the webhook validates Google's OIDC token, the worker syncs the review and the moderation state is stored with the reply record.

Google delivers notifications asynchronously; this is event-driven, not a guaranteed instant/one-second service.

## 8. Test before enabling automatic replies

Keep automatic replies Off until all of these checks succeed:

- Google Basic API Access is approved.
- OAuth Web Client is saved and the original Business Profile Owner is connected.
- Manual review sync succeeds.
- Pub/Sub topic and authenticated push subscription are configured and review notifications are enabled.
- The replacement OpenRouter key is saved and a free AI test succeeds.
- A test reply is reviewed and its Google moderation status is confirmed.

Automatic replies remain disabled by default. The app checks for Google's returned reply state and does not label a reply as published unless Google confirms approval. Replies that are pending, rejected, mismatched or not confirmed remain visibly distinct.

## Troubleshooting

| What you see | What to check |
|---|---|
| API access still says `access_pending` | Google Basic API Access approval has not been granted yet. Check the project quota in Google Cloud. |
| OAuth client cannot be saved | Confirm you are signed in as the original WashDesk Workspace Owner and copied the Web Client ID and Secret correctly. |
| Redirect URI mismatch | Copy the URI from the WashDesk wizard and paste it exactly in the OAuth Web Client. |
| Wrong Google account | Reconnect using the Google account that owns or manages PRIME AUTO CARE. |
| Pub/Sub identity mismatch | Confirm the subscription uses the exact endpoint and audience displayed in WashDesk, the correct service account, and the Pub/Sub service-agent Token Creator permission. |
| AI key is not configured | Revoke the exposed key, create a replacement and save it in the WashDesk Setup wizard. |
| AI rate limit reached | OpenRouter free variants are currently limited to 50 requests/day and 20 requests/minute for accounts without qualifying credits. Wait for the quota reset or choose a paid model explicitly. |
| Reply remains pending | Google has not yet confirmed moderation approval. Do not treat a submitted reply as publicly approved. |

## Security and ownership

- The original WashDesk Workspace Owner record is not changed by this setup.
- Only the original Workspace Owner can save/rotate Google OAuth, OpenRouter and internal Pub/Sub secrets.
- Secret values are stored in Supabase Vault. The app receives readiness flags, not the values.
- Do not place service-role keys, Google Client Secrets, Google refresh tokens, OpenRouter keys or internal worker tokens in GitHub, APKs, browser storage or screenshots.
- Do not enable automatic reply publication until the end-to-end checks above pass.
