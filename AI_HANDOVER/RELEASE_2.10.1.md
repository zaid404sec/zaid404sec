# WashDesk 2.10.1 — Build Reliability Patch

_Date: 18 November 2026_

## Why this patch exists

The 2.10.0 feature branch passed its Android APK, Windows EXE, Google Review API/OAuth type-check, source archive and combined release-package CI jobs. After merge, the main-branch rebuild failed during npm dependency installation because npm resolved a non-existent @supabase/storage-js 2.119.1 tarball.

The public npm package listings currently show @supabase/supabase-js 2.119.0 and @supabase/storage-js 2.119.0 as the published 2.119 release. This patch pins both the direct SDK and the transitive Storage SDK to 2.119.0 so CI does not request the missing 2.119.1 tarball.

## Exact changes

- App package version is 2.10.1.
- App dependency @supabase/supabase-js is pinned to exact version 2.119.0 (no caret range).
- Root npm override pins @supabase/storage-js to exact version 2.119.0.
- Google Review API and OAuth callback Edge Function imports are pinned to npm:@supabase/supabase-js@2.49.1. The production Google Review API already runs successfully with 2.49.1.
- Service-worker cache is refreshed to prime-auto-care-shell-v32.
- Android package ID remains com.washdesk.carwash.v24; workflow calculates versionCode 21001 and versionName 2.10.1.
- 2.10.0 AI Growth Studio code, daily draft guard, review reply drafting, keyword suggestions, real-photo posters, manual Google publishing fallback, warm liquid-glass style, website enquiry form and all existing ERP features are retained.

## Production backend state

The additive table public.pac_google_growth_daily_runs was applied on 18 November 2026. Live verification showed RLS enabled and grants restricted to postgres/service_role. The Google Review API is ACTIVE version 4 and includes the ensure-daily-growth-posts action. The current v24 session remains a workspace member with a scoped google_reviews_admin permission. The original Workspace Owner remains unchanged.

The production AI Growth tables contain no post/keyword rows yet; this is normal before a user adds an OpenRouter key and generates their first drafts. No Google OAuth credentials and no synced Google reviews are currently present.

## Free AI use

Open WashDesk → Google Reviews → AI Growth Studio. Create a free OpenRouter key at https://openrouter.ai/keys, paste it in the device-only key field and test it. Save a separate key on each device that should generate content. The key is stored locally on that device only; it is not shared between devices or included in backup files.

Daily AI drafts are attempted when an authorised device opens the Review Center with its key saved. The app creates up to two drafts per workspace per India calendar date; this is not background processing when the app is closed. Provider quotas and availability can change. Drafts require human review and are not auto-published.

## Google publishing limitations

Without Google Business Profile Basic API Access approval and OAuth, WashDesk cannot automatically import reviews or publish replies/posts/photos to Google. Manual reply workflow: open Google Business Profile Manager, copy the public review into WashDesk, generate/check/copy the reply, paste it on the correct Google review in Google and press Reply. For posts, review the AI draft, upload a real business photo, optionally make the branded poster, copy the text and publish manually in Google.

Do not claim AI relevance scores are actual Google monthly search-volume figures. Compare suggested terms in Google Trends.

## Website status

Expected URL: https://zaid404sec.github.io/zaid404sec/website/

The Pages workflow build stage completed, but the GitHub Pages deployment stage has failed repeatedly. The repository owner's GitHub Settings → Pages → Build and deployment → Source must be set to GitHub Actions. After saving that setting, rerun the Pages workflow and verify the public website URL before listing it on Google Business Profile. The website enquiry form opens a prepared WhatsApp message; it is not a confirmed booking and does not collect an advance payment.

## Booking / advance payments

Appointment capacity, confirmed slot reservations, deposits, refunds, cancellations and payment webhooks are not part of 2.10.1. They require a separate additive booking schema and a configured payment provider/merchant account. The current site enquiry form must not be represented as a booking or deposit facility.

## Installation and data safety

- No migration resets or overwrites existing business records.
- Do not uninstall v23/v24, clear app storage or restore the same backup separately on multiple paired devices.
- APK uses the existing package ID, but CI debug signing may differ from the currently installed APK's signing certificate. If Android reports a signature conflict, stop and keep the old install.
- A successful CI build verifies automated compilation, not hands-on device acceptance. Check invoice PDF, backup/restore, cloud sync, Android notification and Google Review Center on a test device before production use.
