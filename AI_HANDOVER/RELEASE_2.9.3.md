# WashDesk 2.9.3 — Release candidate notes

Last checked: 18 November 2026 (Asia/Kolkata).

## Release status

This is a release-candidate handover, not a claim that 2.9.3 has shipped. The change is in pull request #58 and must pass CI before merge. No 2.9.3 APK, EXE or ZIP is considered valid until it is produced by the successful workflow for the merged commit.

- Repository: https://github.com/zaid404sec/zaid404sec
- Candidate branch: `fix/google-review-admin-v24-2.9.3`
- Pull request: https://github.com/zaid404sec/zaid404sec/pull/58
- Baseline main release: 2.9.2, Android package ID `com.washdesk.carwash.v24`
- Candidate Android package ID: unchanged, `com.washdesk.carwash.v24`

## Changes in this candidate

1. Adds a server-only `pac_google_review_admins` allowlist for the single permission `google_reviews_admin`.
2. Google Review API permits the original workspace owner or a member with that specific allowlist permission.
3. OAuth callback rechecks the initiating session's permission before completing the callback.
4. Review Center displays whether this device has Google Reviews administration permission and its ordinary workspace role.
5. The v24 member is not promoted to workspace owner. No billing, invoices, inventory, customer, payroll or general workspace administration permissions are added.
6. Adds a Deno type-check job to release CI, updates the app version and artifact names to 2.9.3, and refreshes the offline shell cache.

## Production change gate

The new migration is additive and server-only. At the time of this check it has **not** been applied to production, and the v24 allowlist grant has **not** been inserted. No production permissions or workspace owner identity have been changed by this candidate branch.

After the migration has been applied, the grant must be limited to the exact v24 device identity confirmed from live API logs and the existing Prime Auto Care workspace membership. Keep its membership role as `member`. Never copy a pairing code into the source or release archives.

## Google integration status

Production Supabase reported all seven deployed Edge Functions as ACTIVE on 18 November 2026. However, a database check showed:

- OAuth credentials: 0
- Synced Google reviews: 0
- Pub/Sub events: 0
- Review sync logs: 0
- Enabled notification settings: 0

Therefore Google OAuth has not been completed, live review sync has not been demonstrated, and Pub/Sub alerts have not been verified. Google Basic API Access approval and the required OAuth, encryption, Gemini and Pub/Sub secrets are separate prerequisites. They must be configured securely in Google Cloud and Supabase; no secrets belong in the app, repository or ZIP.

## AI feature boundary

The current application can request Gemini review analysis and reply drafts, and an authorised Google Reviews administrator can explicitly approve and publish a draft. This candidate does **not** make Gemini publish replies automatically in the background. The worker currently syncs review data; it does not perform the automatic public-reply policy.

The requested AI thank-you video creator and automated Google Business Profile/local-SEO optimisation assistant are not included in this candidate. Do not describe these as shipped features.

## Installer and data safety

The release workflow currently builds a debug Android APK with a runner-generated signing identity. A new APK using the same package ID may still fail to install as an update over an existing v24 build if its signing identity differs. Do not uninstall v23 or v24. Export a full JSON backup, confirm the app is paired to the same Prime Auto Care cloud workspace, and verify customer, invoice, inventory and payment records before switching daily operations.

A successful CI build is not a substitute for physical-phone acceptance tests: installation/signature compatibility, PDF viewing/sharing, notifications, offline/online cloud sync, and backup restore must be checked on the actual device.

## Required completion sequence

1. Pass the 2.9.3 pull-request checks.
2. Merge the candidate and confirm the merged commit.
3. Apply the additive permission migration to the existing Supabase project.
4. Grant Google Reviews-only access to the exact v24 member session; leave its workspace role and original owner unchanged.
5. Deploy the updated Google Review API and OAuth callback; verify the function versions.
6. Retrieve artifacts only from the successful post-merge 2.9.3 run.
7. Deliver the APK, Windows installer, app source ZIP, complete repository ZIP, combined release ZIP and this DOCX guide with verified hashes.
8. Complete Google API approval/OAuth/Gemini/PubSub configuration and live acceptance tests.

