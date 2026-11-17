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

The email address and Profile ID are configuration identifiers, not credentials. Never commit OAuth secrets, access/refresh tokens, service-role keys, encryption keys or Gemini keys.

## Website

The mobile-first single-page site lives at `website/index.html` and is deployed as part of the existing `.github/workflows/pages.yml` job. It uses a black-and-gold design and includes service descriptions, address, business hours, phone/WhatsApp contact, LocalBusiness structured data, and the exact Google Business Profile link supplied by the owner.

Expected public URL: `https://zaid404sec.github.io/zaid404sec/website/`

The Pages workflow runs on pushes to `main` (and can be manually dispatched). The site is not considered published until the Pages deployment succeeds and the expected URL opens on a phone.

After publication, the owner must:
1. Sign in to Google as `bmumz3909@gmail.com`.
2. Open the Prime Auto Care Business Profile.
3. Choose **Edit profile → Contact → Website**.
4. Add `https://zaid404sec.github.io/zaid404sec/website/`, save, and confirm the public Profile displays it.

This last Profile edit is an owner-only Google UI action; this repository cannot perform it on the owner's behalf.

## WashDesk 2.9.0 staged scope

The app release candidate uses Android application ID `com.washdesk.carwash.v22`, so it can be installed alongside the current v21 / 2.8.4 app for verification. It does not overwrite v21 data.

### Level 1 — Gemini Review Chatbot
- Natural-language questions over genuine, synced Business Profile reviews.
- Review evidence IDs returned with answers.
- Read-only; cannot publish replies or change invoices/business records.

### Level 2 — Gemini Review Management Agent
- Per-review sentiment, topics, complaint flag and priority classification.
- Context-grounded reply drafts and operational recommendations.
- Strictly validated AI output before persistence.
- Public replies are published only after an explicit owner approval in WashDesk.

### Level 3 — Multi-agent Business Growth Copilot
- Review Analyst Agent.
- Customer Experience Agent.
- Improvement Planner Agent.
- Management Reporter Agent.
- A coordinator combines the reports into an evidence-led owner brief.
- Requires real synced review data (at least two reviews) and stores the report history. It does not issue refunds, contact customers, change billing or publish replies.

The default Gemini model is `gemini-3.8-flash`. Override with the server-side `GEMINI_MODEL` secret if needed. The Gemini API key must remain on the Supabase server.

### Review collection and invitation
- Review inbox, rating distribution, average rating, unanswered count and last-sync status.
- Invoice PDF includes a QR that opens the owner's supplied Google Business Profile link, plus the configurable direct review URL.
- A5 printable counter QR poster.
- WhatsApp request opens a prefilled chat; a staff member checks and sends it.
- Prepared and confirmed-sent invitation activity is tracked separately.
- Review counts are never attributed to a specific invoice. Invitation numbers and Google reviews are separate measures.

### Sync behaviour in this staged build
- Owner-authorised OAuth 2.0 connection.
- Manual review sync and deduplication by Google review resource.
- Supabase scheduled reconciliation worker runs every four hours after a first successful connection and schedule configuration.
- **Google Pub/Sub push notifications are not yet implemented in this candidate.** The database has room for a topic name, but immediate push alerts must not be represented as active. They are a follow-on integration requiring a Pub/Sub topic, subscription receiver and notification-setting registration with Google.

## Google API eligibility and owner application

Google's published API prerequisites require a Google account, a verified Business Profile active for at least 60 days, a website representing the business listed on the Profile, a Google Cloud project and approval through **Application for Basic API Access**. Use an account listed as an owner or manager on the Profile. A project showing 0 QPM has not been approved; the published approved quota is 300 QPM.

Official instructions:
- Prerequisites and Basic API Access: https://developers.google.com/my-business/content/prereqs
- OAuth setup: https://developers.google.com/my-business/content/oauth-setup
- Review data: https://developers.google.com/my-business/content/review-data
- OAuth scope required: `https://www.googleapis.com/auth/business.manage`

Once the public website is listed on the Business Profile:
1. Confirm or create a Google Business Profile **Organization account** through the Google Business Profile Help Centre, as listed in Google's API prerequisites.
2. Open Google Cloud Console using `bmumz3909@gmail.com`.
3. Create or select a project, e.g. **Prime Auto Care WashDesk Reviews**. Record its numeric Project Number.
4. Submit Google's **Application for Basic API Access** and give the requested business details, use case, Profile information and Project Number.
5. Wait for Google's approval. Approval cannot be guaranteed by WashDesk.
6. After approval, enable the required Business Profile APIs in that project and create an OAuth 2.0 Web application client.
7. Configure the OAuth consent screen with the application name and the privacy/terms links required by Google's review.

### OAuth redirect URL

Use this exact authorised redirect URI in the Google OAuth Web client:

```
https://jkjudmkqaebrgllemris.supabase.co/functions/v1/google-review-oauth-callback
```

The same URL is required as the Supabase Function secret `GOOGLE_OAUTH_REDIRECT_URI`.

## Server deployment and secrets

No secrets belong in the APK, EXE, HTML, JavaScript bundle or repository. Add these in the existing Supabase project under **Project Settings → Edge Functions → Secrets**:

| Secret | Purpose |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth Web client ID from Google Cloud |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth client secret from Google Cloud |
| `GOOGLE_OAUTH_REDIRECT_URI` | Exact redirect URL shown above |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | Base64 encoding of 32 cryptographically random bytes (AES-256-GCM key) |
| `GEMINI_API_KEY` | Gemini API key, stored server-side only |
| `GEMINI_MODEL` | Optional; default is `gemini-3.8-flash` |
| `GOOGLE_REVIEW_WORKER_SECRET` | Long random secret for scheduled worker invocation |

Supabase supplies the project URL and service credentials to Edge Functions. Do not copy a service-role key into this repository or APK.

The existing GitHub Actions deployment workflow `.github/workflows/deploy-communications.yml` requires these repository Actions secrets:
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

The workflow runs `supabase db push` (applying pending migrations) and deploys the existing communications functions plus:
- `google-review-api`
- `google-review-oauth-callback`
- `google-review-worker`

Do not run the workflow until these repository secrets and Google-related Supabase secrets are correctly configured. The new SQL migration is additive and does not drop or rewrite business tables.

### Four-hour scheduled catch-up sync

After deploying the functions and configuring secrets, open Supabase SQL Editor and run `google-reviews-cron-setup.sql` once. Before running it, create these two Supabase Vault secrets:
- `pac_google_review_worker_url` = `https://jkjudmkqaebrgllemris.supabase.co/functions/v1/google-review-worker`
- `pac_google_review_worker_secret` = exactly the same value as `GOOGLE_REVIEW_WORKER_SECRET`

Check the returned `cron.job` row to verify the active four-hour schedule. Run one successful manual sync from WashDesk first; the worker processes workspaces with connected status.

## Data access and safety

- Existing customer, invoice, inventory, expense, staff, payroll and cloud-sync tables are not dropped or rewritten.
- Google OAuth tokens are encrypted with AES-256-GCM and stored server-side.
- Workspace membership is checked on requests; only the workspace owner can connect Google or publish replies.
- AI reply drafts are never automatically published.
- No invented ratings, review entries, or review-to-invoice conversions.
- Review requests are neutral and optional. No incentives, review gating, selective positive-only requests, pressure at the premises, or staff review quotas.

Google review policy: https://support.google.com/contributionpolicy/answer/7400114

## Staged versus complete

Implemented in the feature branch: website source, app UI, QR support, client adapter, additive migration, authenticated Edge Functions, OAuth callback, Gemini levels, reply approval gate, scheduled reconciliation worker and CI validation rules.

Still requires account-owner / external setup:
- Merge after CI passes and confirm the GitHub Pages deployment.
- Add the live website URL to the Business Profile.
- Submit and obtain Google Basic API Access approval.
- Configure Google OAuth credentials, Supabase/GitHub deployment secrets and Gemini API key.
- Deploy the Supabase migration/functions and configure the Vault-backed four-hour job.
- Complete owner OAuth consent, test the Google location match and run a live sync.
- Add Pub/Sub notifications in a follow-up once the API is approved.
- Test on a real Android phone and Windows PC. CI is not physical-device testing.

Do not describe live Google sync or AI as operational until those external steps are complete.
