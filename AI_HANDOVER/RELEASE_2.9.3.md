# WashDesk 2.9.3 — Production release notes

Release date: 18 November 2026.

## Release identity and build proof

- GitHub repository: https://github.com/zaid404sec/zaid404sec
- Pull request: https://github.com/zaid404sec/zaid404sec/pull/58 (merged)
- Main commit: `f006415568af5960e25bd52ee562bccac02fa627`
- Main build: [GitHub Actions run #233](https://github.com/zaid404sec/zaid404sec/actions/runs/44269802537) — **success**
- Application version: `2.9.3`
- Android package ID: `com.washdesk.carwash.v24` (unchanged)
- CI checks: app validation passed; Google Reviews API/OAuth callback Deno checks passed; Android APK job passed; Windows EXE installer job passed; source and full-release packaging passed.

The deliverables were downloaded from the successful main-branch run #233 and verified locally. APK, EXE, project source ZIP, complete handover ZIP and combined release ZIP are included in that run's artifact set.

## Changes shipped

1. Added `pac_google_review_admins`, a server-only allowlist for the single permission `google_reviews_admin`.
2. Google Review API sensitive actions now allow either the existing workspace owner or a member with that exact active permission.
3. OAuth callback revalidates the initiating device's permission before it finishes the OAuth flow.
4. Review Center status includes scoped permission information.
5. The Android app remains on the existing v24 package ID; no new install identity was introduced.
6. Added a Deno type-check step for the Google Review API and OAuth callback to CI.
7. Updated version metadata and the offline cache validation for 2.9.3.

## Live Supabase deployment verification

The additive migration `20261118082000_google_review_admins` is applied to the existing project. The exact v24 session has one active `google_reviews_admin` permission.

- v24's ordinary workspace role remains `member`.
- The original Workspace Owner remains unchanged.
- No permission was added for billing, invoices, inventory, customer management, purchases, payroll or general workspace administration.
- The new permission table has RLS enabled, no authenticated policies and no grants to `anon` or `authenticated`; only `service_role` has table access.
- `google-review-api` and `google-review-oauth-callback` are deployed and ACTIVE at version 2.
- The other five existing communications/Google review functions remain ACTIVE.

This fixes the WashDesk permission blocker for the existing v24 session. It does not itself complete Google OAuth or make Google API access available.

## Google integration still awaiting external activation

The latest live database check showed:

| Item | Current verified result |
|---|---:|
| Stored Google OAuth credentials | 0 |
| Synced Google reviews | 0 |
| Pub/Sub review events | 0 |
| Review sync logs | 0 |
| Enabled notification settings | 0 |

Remaining prerequisites:
- Google Business Profile API Basic Access approval must be confirmed in the Google Cloud project.
- The Google OAuth Client ID/Secret and redirect URI, plus the 32-byte Base64 encryption key, must be configured as Supabase Edge Function secrets.
- Connect the primary Business Profile owner through Google's official OAuth consent flow from WashDesk.
- Configure `GEMINI_API_KEY` to enable Gemini review analysis and reply drafting.
- Configure Pub/Sub topic, authenticated push subscription, OIDC identity and worker secrets before enabling instant alerts.
- GitHub Pages run #69 built the site but the deploy step failed; the website's public availability and GBP website listing are not confirmed.

Do not put service keys, OAuth secrets, Gemini keys, pairing codes or access tokens in the APK, source ZIP, repository or chat.

## AI behaviour boundary

The shipped app can analyse a synced review and produce a Gemini reply draft; an authorised Google Reviews administrator must explicitly approve and publish it. The background review worker currently syncs review data; it does not automatically create and publish Gemini replies.

The AI thank-you video creator and automated Google Business Profile/local-SEO optimisation assistant are **not included** in 2.9.3. They must not be described as live features.

## Android signing and installation warning

The GitHub Actions workflow produced a debug APK using the CI runner's generated signing key. The package ID remains v24, but this does not prove that the signing certificate matches the APK already installed on the owner's phone. Android can reject an APK update when the signing certificates differ.

**Do not uninstall v23 or the existing v24 app.** The production permission update is server-side and already applies to the existing paired v24 session. Use that existing installation for the Google Reviews permission test first. Do not attempt to overwrite the working v24 until certificate continuity has been confirmed. A persistent signing key from the original v24 release is needed to guarantee an in-place APK update.

## Artifact names and SHA-256

The following SHA-256 values were calculated from the extracted files in the verified release package:

| File | SHA-256 |
|---|---|
| `Prime-Auto-Care-2.9.3.apk` | `23514e3fd715b17ad3fe42ad5f464584e277af52d3d238d6ace310cf95b74841` |
| `Prime-Auto-Care-Setup-2.9.3-x64.exe` | `8f94c0e67640b7a83fc1ba017498945ea0dc8fbaa8306095d1ee2d9ceee9f376` |
| `WashDesk-Prime-Auto-Care-2.9.3-Project-Source.zip` | `721aebcd5610ed6a2763b966ae0beeef92f869720ece34a1b835c2c951f8436c` |
| `WashDesk-Prime-Auto-Care-2.9.3-Complete-Handover.zip` | `5739b755c483a174f8bdda0d18695dbb8ad967c0983cac5c90a89133b3f01549` |
| `WashDesk-Prime-Auto-Care-2.9.3-Full-Release-Package.zip` | `3396a52acddb4dab3e715120c63831119cd1e4cd8c9b39a900ad16794bde5af5` |

GitHub Actions artifact IDs from run #233:
- APK: `14412485729`
- Windows installer: `14411937193`
- Application source ZIP: `14411384233`
- Complete project handover ZIP: `14412151974`
- Combined full release package: `14412600584`

## Manual phone acceptance tests still required

CI verifies syntax, business regression tests, Deno types and the creation/integrity of release files. It does not prove installation over the current v24 package, WhatsApp handoff, notifications after reboot, offline/online sync or real backup restore. Keep the current app and a fresh JSON backup until those tests have passed.
