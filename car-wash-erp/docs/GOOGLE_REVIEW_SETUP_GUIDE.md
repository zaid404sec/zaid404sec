# Prime Auto Care — Google Review Center setup guide

This guide is for WashDesk 2.12.1 and the existing Prime Auto Care Supabase project.

## First: understand the two different credentials

- **Google Business Profile API access** is for reading reviews, syncing review changes and publishing an approved business reply. It requires a Google Cloud project, Basic API Access approval and Google OAuth consent.
- **OpenRouter API key** is only the AI provider credential for drafting review responses and Google post content. It is not a Google credential and cannot enable Google Business Profile API access.

The OpenRouter key previously pasted into chat is exposed. Revoke that key and create a replacement. Never add the replacement to the APK, Windows installer, GitHub source, local storage, or chat. Add it only in Supabase Edge Function Secrets as \`OPENROUTER_API_KEY\`.

## 1. Check Business Profile eligibility

Use the Google account that is listed as an owner or manager of PRIME AUTO CARE.

1. Open the <https://business.google.com/> Business Profile manager.
2. Confirm PRIME AUTO CARE is verified and has been active for more than 60 days.
3. Publish the business website and add the same website URL to the Business Profile under **Edit profile → Contact → Website**.
4. Keep the profile complete and current, including address, phone, services and hours.

Google's prerequisites and Basic API Access application: <https://developers.google.com/my-business/content/prereqs>.

## 2. Create or select the Google Cloud project

1. Open <https://console.cloud.google.com/>.
2. Sign in with the Business Profile owner/manager account.
3. Create a project named **Prime Auto Care WashDesk Reviews**, or select the project that will own the integration.
4. On the project's Dashboard, copy the numeric **Project Number** (not the project name and not the project ID).
5. In WashDesk → Google Review Center → Setup wizard, paste the numeric Project Number and press **Save project number**.

The number is saved against the existing workspace; no Workspace Owner role is changed.

## 3. Request Google Business Profile Basic API Access

1. Open the Google prerequisites page.
2. Select the same Google Cloud project.
3. Submit Google's **Application for Basic API Access** form.
4. Enter the numeric Project Number and use an email that is listed as an owner/manager on PRIME AUTO CARE.
5. Wait for Google's review and approval email.

To check approval, open **Google Cloud Console → APIs & Services → Enabled APIs & services → Quotas** for the Business Profile APIs. Google's documentation describes 0 QPM as not approved and 300 QPM as approved. WashDesk cannot apply for or grant Google's approval on Google's behalf.

## 4. Enable the Business Profile APIs

After Google approves the project, open <https://console.cloud.google.com/apis/library> and enable these seven Business Profile APIs:

1. Google My Business API
2. My Business Account Management API
3. My Business Lodging API
4. My Business Place Actions API
5. My Business Notifications API
6. My Business Verifications API
7. My Business Business Information API

Google's Basic setup guide: <https://developers.google.com/my-business/content/basic-setup>.

## 5. Create the OAuth Web Client

1. Open <https://console.cloud.google.com/auth/clients>.
2. Choose **Create client → Web application**.
3. Add the exact authorised redirect URI displayed in the WashDesk setup wizard:

   \`https://jkjudmkqaebrgllemris.supabase.co/functions/v1/google-review-oauth-callback\`

4. Create the client and copy the **Client ID** and **Client Secret**.
5. In <https://supabase.com/dashboard/project/jkjudmkqaebrgllemris/functions/secrets>, add the following Edge Function Secrets:

| Secret name | Value |
|---|---|
| \`GOOGLE_OAUTH_CLIENT_ID\` | OAuth Web Client ID |
| \`GOOGLE_OAUTH_CLIENT_SECRET\` | OAuth Web Client Secret |
| \`GOOGLE_OAUTH_REDIRECT_URI\` | Exact callback URI above |
| \`GOOGLE_TOKEN_ENCRYPTION_KEY\` | Base64 encoding of 32 random bytes |

Do not put any of these values in a source file, APK, browser field, screenshot or GitHub repository. Supabase Edge Function Secrets is the server-side location for them.

## 6. Connect the original Google Business Profile owner in WashDesk

1. Open the installed WashDesk app on a device already paired to the Prime Auto Care workspace.
2. Open **Google Review Center → Setup wizard**.
3. Refresh setup status and confirm the OAuth items display **Ready**.
4. Press **Connect Google Owner Account**.
5. In the Google consent page, choose the original Business Profile owner account configured for PRIME AUTO CARE (currently recorded in the workspace as \`bmumz3909@gmail.com\`).
6. Review and approve the Business Profile scope.
7. Return to WashDesk. The wizard should show the Google account as connected.
8. Press **Sync reviews** and confirm review rows and a successful sync timestamp appear.

The existing WashDesk pairing/session authenticates the app to its own workspace. It does not replace Google's separate consent for access to the Business Profile. WashDesk must never ask the user to type a Google password into the app.

## 7. Configure Google Pub/Sub notifications

This enables event-driven review updates. Google still controls delivery timing; it is not a guaranteed one-second response service.

1. In the same Google Cloud project, open <https://console.cloud.google.com/cloudpubsub>.
2. Create a topic such as \`prime-auto-care-reviews\` and copy its full resource name:
   \`projects/PROJECT_ID/topics/prime-auto-care-reviews\`.
3. Grant the Google Business Profile publisher identity \`mybusiness-api-pubsub@system.gserviceaccount.com\` the **Pub/Sub Publisher** role on that topic.
4. Create an authenticated push subscription targeting:

   \`https://jkjudmkqaebrgllemris.supabase.co/functions/v1/google-review-pubsub-webhook\`

5. Use a dedicated push service account and set its OIDC audience to the exact webhook URL above.
6. Grant the Pub/Sub service agent permission to mint tokens for that push service account (the Service Account Token Creator role on that service account).
7. In Supabase Edge Function Secrets, add:

| Secret name | Purpose |
|---|---|
| \`GOOGLE_REVIEW_WORKER_SECRET\` | Long random secret used only for internal worker calls |
| \`GOOGLE_PUBSUB_TOPIC_NAME\` | Full Pub/Sub topic resource name |
| \`GOOGLE_PUBSUB_AUDIENCE\` | Exact webhook URL |
| \`GOOGLE_PUBSUB_PUSH_SERVICE_ACCOUNT\` | Push service account email |

8. Return to WashDesk → Setup wizard and refresh status. Once the Pub/Sub items are ready, press **Enable Google review alerts**.
9. Run a test event and confirm the event appears in the Google Review event table and the worker sync log.

Google notification guide: <https://developers.google.com/my-business/content/notification-setup>.

## 8. Configure the AI provider key

1. Revoke the OpenRouter key that was pasted into chat.
2. Create a replacement at <https://openrouter.ai/keys>.
3. Open Supabase → Edge Function Secrets.
4. Add the replacement value as \`OPENROUTER_API_KEY\`.
5. Return to the WashDesk AI Growth Studio / Google Review Center and press **Test free AI**.

WashDesk calls \`openrouter/free\` on the server. The key is not stored in the browser or sent back to the client. OpenRouter documents free model limits of 20 requests per minute and 50 requests per day for a free account; provider/model availability can vary. See <https://openrouter.ai/collections/free-models>.

## 9. Turn on automatic review replies only after all tests pass

Automatic replies remain Off by default. The Original Workspace Owner should enable them only after:

- Google Basic API Access is approved.
- Owner OAuth is connected.
- A manual review sync succeeds.
- Pub/Sub notification registration and test event delivery succeed.
- The replacement OpenRouter key and worker secret are configured.

The system only considers the exact new/updated review associated with a Pub/Sub event. It skips existing Google replies and holds low ratings or detected complaint language for human review. Google may show a reply as **Pending moderation** or **Rejected**. WashDesk displays that state and the public website only displays a business reply when Google reports it as **APPROVED**.

There is no guaranteed one-second publication SLA. Pub/Sub delivery, AI generation, Google API response and Google's moderation status each introduce variable delay.

## Troubleshooting

| What you see | What to check |
|---|---|
| OAuth button disabled | Set all four OAuth secrets and confirm the redirect URI is an exact match. |
| Google returns 403 / access pending | Basic API Access is not yet approved, the wrong Cloud project is used, or the required API has not been enabled. |
| Google authorises the wrong account | Reconnect with the original PRIME AUTO CARE Business Profile owner account. |
| Notifications stay disabled | Check the topic publisher permission, push subscription, OIDC audience/service account, and four Pub/Sub secrets. |
| AI test says server key missing | Add the replacement \`OPENROUTER_API_KEY\` in Supabase Edge Function Secrets and refresh the wizard. |
| AI says quota exceeded | OpenRouter free quota may have been reached; wait for reset or use a different approved provider/model. |
| Reply shows Pending moderation | Google accepted the request but has not approved the reply for public display yet. Do not resubmit repeatedly. |
| Reply shows Rejected | Review Google's policy feedback and prepare a compliant replacement for human review. |
