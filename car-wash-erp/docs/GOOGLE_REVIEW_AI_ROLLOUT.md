# Prime Auto Care — Google Review AI Center and public website

## Owner-provided Business Profile details

| Field | Value |
|---|---|
| Google owner account | `bmumz3909@gmail.com` |
| Profile role | Primary owner (provided by owner) |
| Business Profile ID supplied | `13506481990772076097` |
| Profile link | `https://share.google/6g3f0aJqTezi6JH5T` |
| WhatsApp invitation number | `+91 77779 70261` |
| Website | `https://zaid404sec.github.io/zaid404sec/website/` (expected after GitHub Pages deployment) |

The email address, Profile ID and phone number are configuration identifiers, not credentials. Never commit OAuth secrets, access/refresh tokens, service-role keys, encryption keys or Gemini keys.

## Website

The mobile-first single-page site lives at `website/index.html` and is included by the existing `.github/workflows/pages.yml` workflow. It uses the black-and-gold Prime Auto Care identity, service descriptions, location, opening hours, phone/WhatsApp contact, LocalBusiness structured data and the exact Google Business Profile link supplied by the owner.

Expected public URL: `https://zaid404sec.github.io/zaid404sec/website/`

### Current publishing status

The Pages build job successfully built and uploaded the site artifact, but the GitHub Pages deployment job failed, including on one retry. The site must not yet be treated as public. The repository owner must open GitHub **Settings → Pages → Build and deployment** and make sure **Source = GitHub Actions**. Then rerun **Deploy WashDesk to GitHub Pages** and verify the URL on a phone.

After publication, the owner must:
1. Sign in to Google as `bmumz3909@gmail.com`.
2. Open the PRIME AUTO CARE Business Profile.
3. Choose **Edit profile → Contact → Website**.
4. Add `https://zaid404sec.github.io/zaid404sec/website/`, save and confirm the public Profile displays it.

The Business Profile edit is an owner-only Google UI action; the repository cannot perform it on the owner's behalf.

## WashDesk 2.9.1 — Pub/Sub-enabled follow-up

Android application ID: `com.washdesk.carwash.v23`. It can be installed alongside the earlier v21 and v22 apps during verification; it does not overwrite their local app data.

### Level 1 — Gemini Review Chatbot
- Natural-language questions over genuine, synced Business Profile reviews.
- Answers use the current review dataset and supporting evidence IDs.
- Read-only; cannot publish replies or change invoices/business records.

### Level 2 — Gemini Review Management Agent
- Per-review sentiment, topics, complaint flag and priority classification.
- Context-grounded reply drafts and operational recommendations.
- Strictly validated AI output before persistence.
- Public Google replies are published only after an explicit owner approval in WashDesk.

### Level 3 — Multi-agent Business Growth Copilot
- Review Analyst Agent.
- Customer Experience Agent.
- Improvement Planner Agent.
- Management Reporter Agent.
- A coordinator combines their reports into an evidence-led owner brief.
- Requires genuine synced review data (at least two reviews), stores report history, and does not issue refunds, contact customers, change billing or publish replies.

The default server-side AI model is `gemini-3.8-flash`. It can be overridden with the `GEMINI_MODEL` Supabase Function secret. The Gemini API key remains server-side and is never included in the APK.

### Review collection and invitations
- Review inbox, rating distribution, average rating, unanswered count and last-sync status.
- Invoice PDF includes a QR that opens the owner's supplied Google Business Profile link, plus the configurable direct review link.
- Printable A5 counter QR poster.
- WhatsApp invitations open a prefilled chat; staff review and send manually.
- Prepared and confirmed-sent invitation activity is tracked separately.
- Review counts are not attributed to individual invoices.

### Google review monitoring

The release has three refresh paths:
1. **Manual sync** from the Google Review Center.
2. **Google Pub/Sub push notifications** for new/updated reviews. The server verifies the push subscription's Google OIDC identity, deduplicates Pub/Sub message IDs, records the event and immediately triggers a review sync.
3. **Four-hour scheduled reconciliation** as a safety net if a push message is missed.

The app only reports instant alerts as enabled after Google accepts the notification setting. Actual push delivery still requires the Cloud project, topic, subscription and secrets below.

## Google API eligibility and application

Google's published prerequisites require:
- a Google account;
- a verified Business Profile active for more than 60 days;
- a website representing the business listed on that Profile;
- a Google Cloud project and a Business Profile Organization account;
- approval through Google's **Application for Basic API Access**.

Google instructs applicants to use an account listed as owner/manager on the Profile, provide the numeric Google Cloud Project Number and select **Application for Basic API Access** in the contact form. A quota of 0 QPM indicates the project has not been approved; 300 QPM indicates approval.

Official instructions:
- Prerequisites and application: https://developers.google.com/my-business/content/prereqs
- Basic setup and OAuth: https://developers.google.com/my-business/content/basic-setup
- Reviews API: https://developers.google.com/my-business/content/review-data
- Current notification setup: https://developers.google.com/my-business/content/notification-setup
- Notification setting API: https://developers.google.com/my-business/reference/notifications/rest/v1/accounts/updateNotificationSetting
- OAuth scope: `https://www.googleapis.com/auth/business.manage`

After the website is published and listed on the Business Profile:
1. Confirm/create a Business Profile Organization account through Google's Business Profile Help Centre.
2. Open Google Cloud Console as `bmumz3909@gmail.com` and create/select a project, e.g. **Prime Auto Care WashDesk Reviews**.
3. Record the numeric Project Number shown on the project dashboard.
4. Submit Google's Basic API Access request using that Project Number and the Primary Owner account.
5. Wait for Google approval. Approval cannot be guaranteed by WashDesk.
6. Once approved, enable the Business Profile APIs and create an OAuth 2.0 Web application client.

## OAuth callback

Add this exact authorised redirect URI in the Google OAuth Web client:

```
https://jkjudmkqaebrgllemris.supabase.co/functions/v1/google-review-oauth-callback
```

Use the same value for the Supabase Function secret `GOOGLE_OAUTH_REDIRECT_URI`.

## Server secrets

Never store these secrets in the APK, EXE, HTML, JavaScript bundle or GitHub source. Add them in Supabase **Project Settings → Edge Functions → Secrets**:

| Secret | Purpose |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth Web client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | Exact callback URL above |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | Base64 encoding of 32 random bytes for AES-256-GCM |
| `GEMINI_API_KEY` | Gemini API key |
| `GEMINI_MODEL` | Optional; default `gemini-3.8-flash` |
| `GOOGLE_REVIEW_WORKER_SECRET` | Long random secret for internal scheduled/event-triggered sync |
| `GOOGLE_PUBSUB_TOPIC_NAME` | Topic name, e.g. `projects/PROJECT_ID/topics/prime-auto-care-reviews` |
| `GOOGLE_PUBSUB_AUDIENCE` | Exact webhook URL below |
| `GOOGLE_PUBSUB_PUSH_SERVICE_ACCOUNT` | Email of the service account selected for Pub/Sub push OIDC tokens |

Webhook endpoint and audience:

```
https://jkjudmkqaebrgllemris.supabase.co/functions/v1/google-review-pubsub-webhook
```

Supabase provides its own project URL and service credentials to Edge Functions. Never copy a service-role key into the repository or APK.

The GitHub Actions backend deployment workflow `.github/workflows/deploy-communications.yml` requires repository Actions secrets:
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

It applies pending additive migrations with `supabase db push` and deploys:
- `google-review-api`
- `google-review-oauth-callback`
- `google-review-worker`
- `google-review-pubsub-webhook`

Do not run deployment until those GitHub secrets and all required Supabase Function secrets are configured.

## Google Cloud Pub/Sub setup

After Google Basic API Access is approved and the Business Profile APIs are enabled:

1. In Google Cloud Console, create a Pub/Sub topic named `prime-auto-care-reviews` in the same project. Record its full resource name: `projects/PROJECT_ID/topics/prime-auto-care-reviews`.
2. Grant **Pub/Sub Publisher** (or at least `pubsub.topics.publish`) on that topic to Google's Business Profile publisher service account: `mybusiness-api-pubsub@system.gserviceaccount.com`.
3. Create a push subscription for that topic, pointing to the Supabase webhook URL above.
4. Enable authenticated push delivery using an OIDC service account. Set the audience to the exact webhook URL.
5. Grant the Google Cloud Pub/Sub service agent `service-PROJECT_NUMBER@gcp-sa-pubsub.iam.gserviceaccount.com` permission to mint tokens for the selected push service account (Service Account Token Creator), as required by the Pub/Sub authenticated push setup.
6. Add the topic name, webhook audience and push service-account email as the three Supabase secrets above.
7. Deploy the Supabase migration/functions.
8. In WashDesk, open **Google Review Center → Connect Google owner account** and complete OAuth as `bmumz3909@gmail.com`.
9. Tap **Enable instant review alerts**. The app calls the current Notifications API v1 `accounts.updateNotificationSetting` endpoint and subscribes to `NEW_REVIEW` and `UPDATED_REVIEW`.
10. Run one manual sync, then verify the alert status and last received event in the Review Center.

Google's publisher service account needs publish permission on the topic; the separate push service account is used to authenticate the subscription delivery. Do not confuse these two identities.

### Four-hour catch-up job

After deploying the functions and secrets, create these two Supabase Vault secrets and run `google-reviews-cron-setup.sql` once in Supabase SQL Editor:
- `pac_google_review_worker_url` = `https://jkjudmkqaebrgllemris.supabase.co/functions/v1/google-review-worker`
- `pac_google_review_worker_secret` = exactly the same value as `GOOGLE_REVIEW_WORKER_SECRET`

The SQL configures a four-hour scheduled reconciliation. Verify the returned row in `cron.job`.

## Data access and review-policy safeguards

- Existing customer, invoice, inventory, expense, staff, payroll and cloud-sync tables are not dropped or rewritten.
- Google OAuth tokens are encrypted with AES-256-GCM and stored server-side.
- Workspace membership is checked on requests. Only the workspace owner can connect Google, run Gemini features or publish replies.
- AI reply drafts are never automatically published.
- No invented ratings, review entries, or review-to-invoice conversions.
- Review requests are neutral and optional. No incentives, review gating, selective positive-only requests, pressure at the premises or staff review quotas.

Google review policy: https://support.google.com/contributionpolicy/answer/7400114

## Outstanding owner-only / external steps

- Enable GitHub Pages at repository **Settings → Pages → Source = GitHub Actions**, then rerun the Pages deploy; the latest Pages build job succeeded but its deploy job failed on retry.
- Confirm the public website URL loads, then add it to the Google Business Profile.
- Submit the Google Basic API Access application after the URL appears on the Profile.
- Configure Google OAuth, Gemini, Pub/Sub and Supabase secrets; deploy the backend; complete OAuth and enable notifications.
- Test real Pub/Sub delivery and Google review sync after approval.
- Test the APK on a real Android phone and the installer on Windows. CI builds passed, but CI is not physical-device testing.

Until these owner steps are completed, Google live reviews, Pub/Sub alerts and Gemini calls are staged in the app but not active in production.
