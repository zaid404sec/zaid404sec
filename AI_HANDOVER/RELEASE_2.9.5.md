# WashDesk 2.9.5 — Google AI Growth Studio

## Release intent
- Extend the existing Google Review Center into a workspace-scoped AI Growth Studio.
- Keep the original Prime Auto Care Workspace Owner and the v24-only Google Reviews permission unchanged.
- Keep manual Google review replies and post publishing available while OAuth and API approval are pending.
- Keep existing billing, invoices, customers, vehicles, inventory, purchases, expenses, staff, payroll, offline use and shared cloud sync unchanged.
- Apply a warm liquid-glass visual skin to the WashDesk application shell; retain the original invoice PDF templates.

## Google AI Growth Studio
- Free model route: OpenRouter `openrouter/free`.
- API key is stored locally on the device that enters it. It is not written into the source, Supabase, cloud sync, backups or the APK. Each device must be configured separately.
- AI review reply assistant: uses the pasted review text, redacts phone numbers and email addresses, and returns an editable reply draft. Replies are not auto-published.
- Local keyword planner: suggests terms relevant to the actual business and services configured in WashDesk. Each suggestion has an AI relevance score and a link to Google Trends for comparison. Scores are not measured monthly search volume.
- Daily Google post planner: generates two draft posts per run. Drafts are saved in the shared workspace and can be edited, copied or opened in Google for manual posting.
- Real photo uploads: JPG/PNG only, 10 KB to 5 MB, at least 250 × 250 pixels. The system does not create fake customer photos or fabricated before/after evidence.
- Direct post publishing/scheduling is an optional capability. It requires approved Google Business Profile API access, OAuth credentials, the appropriate `business.manage` scope and an accessible Business Profile location.

## Free-tier constraints
- OpenRouter currently lists free variants at 20 requests per minute and 50 requests per day. Providers may be busy or impose model-specific limits; service availability is not guaranteed.
- Free models are the only allowed model IDs in this build. The backend rejects model IDs that are not `openrouter/free` or an ID ending in `:free`.
- No paid model fallback is enabled.
- This is a user-triggered workflow, not an always-on background AI agent. The device's locally stored API key is needed when generating.
- Google Trends is used as a comparison link. This release does not claim exact Surat monthly query volumes; the public Google Trends API is still an alpha-access programme.

## Google Business Profile status
- Manual reply path: open Google Business Profile manager, read the review, draft in WashDesk, copy and publish manually in Google.
- AI reply path: AI prepares a draft; the owner checks it and publishes manually in Google.
- Direct API reply/post publishing, review sync and instant notifications still depend on Google API access/OAuth and the correct profile/location mapping.
- Never mark a reply/post as published unless Google confirms it.

## Website
- Public website path: `https://zaid404sec.github.io/zaid404sec/website/`
- Added canonical URL, Open Graph, Twitter metadata, LocalBusiness/AutoWash structured data, and business-hours metadata.
- GitHub Pages deployment must be checked after merge. A successful build job alone does not prove the deployment URL is live.

## Booking and advance payments
- Appointment booking and customer advance payments are not included in 2.9.5. They are a separate next-phase feature so payment accounting, refunds, rescheduling and invoice allocation can be designed without risking existing ledgers.

## Data protection
- The migration is additive. It creates only the new `pac_google_growth_posts` and `pac_google_growth_keywords` tables and a new photo bucket.
- These tables have RLS enabled and are not directly accessible to `anon` or `authenticated`; access is through the authenticated, workspace-scoped Edge Function.
- No destructive migration or data reset is used.
- No Workspace Owner role, general membership role or Cloud Sync table is changed.

## Build and acceptance
- Application version: 2.9.5
- Android application ID: `com.washdesk.carwash.v24`
- Verify Android APK, Windows EXE, backend Deno type-check, application validation, source ZIP, full handover ZIP and checksums from the same successful GitHub Actions run.
- Android CI currently builds a debug-signed APK. A package-ID match does not guarantee signing-certificate continuity. Keep previous versions installed and check the Android signature before attempting an update.
