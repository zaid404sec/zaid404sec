# Project state — Prime Auto Care / WashDesk

_Last verified: 18 November 2026_

## Current source of truth

| Item | Current verified value |
|---|---|
| GitHub repository | https://github.com/zaid404sec/zaid404sec |
| Default branch | `main` |
| Current main commit | `6dbd32b5f9cda306f2e09218c0786b82b18a3d4c` (2.9.2 baseline) |
| Application folder | `car-wash-erp/` |
| App name | Prime Auto Care |
| App version | **2.9.2** |
| Android application ID | `com.washdesk.carwash.v24` |
| Capacitor | 8.x |
| Build environment | Node 22, Python 3.12, Java 21 |
| Feature PR | [#56 — merged](https://github.com/zaid404sec/zaid404sec/pull/56) |
| Main release build | [Run #223 — Android, Windows and package jobs succeeded (2.9.2 baseline)](https://github.com/zaid404sec/zaid404sec/actions/runs/44242078227) |
| Website deployment | [Pages run #68 — deployment failed](https://github.com/zaid404sec/zaid404sec/actions/runs/44242078236) |
| Supabase project | `jkjudmkqaebrgllemris` |
| Supabase project URL | https://jkjudmkqaebrgllemris.supabase.co |

The 2.9.2 Android APK uses package ID `com.washdesk.carwash.v24`. Package-ID continuity does not guarantee signature continuity: the GitHub build currently emits a debug APK using an ephemeral runner signing key. Do not uninstall either installed app or replace the working v24 until the new APK's signing/install compatibility and shared-cloud data continuity are checked.

## Version 2.9.2 release summary

PR #56 added the Number & notification group manager under Offers & WhatsApp.

- Add, edit and remove named Indian mobile contacts.
- Validate ten-digit Indian mobile numbers and +91-prefixed numbers; prevent duplicate numbers.
- Assign one or more groups: Attendance, Expenses, Staff & payroll, Operations, Sales & bills, Inventory and Offers.
- "All contacts" includes every saved recipient.
- Prepare date-scoped attendance and business-expense messages. Personal/household expenses, salaries and staff advances are excluded from the business-expense summary.
- WhatsApp is manual and one-to-one. The owner reviews and presses Send; there is no silent WhatsApp broadcast or automatic group addition.
- Contact records are persisted in the app's existing database and synchronize through the WashDesk cloud merge path.

The production Supabase migration `20261118050000_add_message_recipients_sync_merge` is applied. It extends the existing `washdesk_merge_sync(jsonb)` collection list with `messageRecipients`; it does not reset the database or rewrite old business records.

## Product capabilities

- Customers, vehicles, service catalogue, price lists and visit history.
- Multi-line invoices, financial-year numbering, discounts, configured GST, partial payments, due balances, A4 PDFs and WhatsApp handoff.
- Inventory, stock movements, purchases, low-stock notices and consumable recipes.
- Staff directory, individual attendance, shifts/hours, salaries, advances and payroll reports.
- Daily/monthly reporting, CSV/Excel/PDF exports, dashboard analytics, backups and restore.
- Local reminder notifications, offline app shell, shared Supabase sync and WhatsApp offers.
- Google Review Center UI, AI analysis/copy generation, reply drafts and notification workflow source code. Live Google API integration is not yet operational; see the deployment state below.

## Production Supabase database state

The existing project is ACTIVE_HEALTHY on PostgreSQL 17. The following additive migrations were successfully applied:

1. `20261112000100_communications_automation`
2. `20261117000100_google_reviews`
3. `20261118000100_google_review_pubsub`
4. `20261118050000_add_message_recipients_sync_merge`
5. `prime_auto_care_communications_automation_20261112`

Verified after deployment:
- Existing `washdesk_sync` snapshot row still present.
- Existing Prime Auto Care workspace still present.
- 24 existing workspace-member records still present.
- New `pac_communication_*` and `pac_google_*` tables exist with RLS enabled.
- All seven deployed Edge Functions were active in the 18 November 2026 check.
- Google review tables currently contain zero OAuth credential rows, synced review rows, Pub/Sub event rows and sync-log rows; no notification setting is enabled.
- A v24-specific Google Reviews admin change is under PR #58. Its additive migration and scoped grant are not yet applied to production.
- The server merge function contains `messageRecipients`.

Do not run setup SQL again as an update shortcut. Do not reset, drop, truncate or reseed production business tables.

## Remaining external activation work

| Workstream | Verified status | Required next action |
|---|---|---|
| Public website | Not live yet. Latest Pages run #67 built and uploaded the site, but its deploy job failed. | Repository Settings → Pages → Build and deployment → Source = GitHub Actions, then rerun the Pages workflow. Confirm the URL opens publicly. |
| Add website to Google Business Profile | Not verified / not done. | After the website is live, add https://zaid404sec.github.io/zaid404sec/website/ under Edit profile → Contact → Website. |
| Google Basic API Access | Approval not verified; no approved Cloud project/quota was seen. | Complete Google’s Basic API Access request using the Cloud project number and a GBP owner/manager account. Google approval is external. |
| Supabase Edge Functions | Seven functions were returned as ACTIVE on 18 November 2026. | The Google Review API and OAuth callback require the 2.9.3 scoped-permission update after PR checks pass. |
| Google OAuth | No OAuth credential rows are stored. | Configure the server secrets, then connect the primary GBP owner after Google API access is approved. |
| Live review sync / alerts | No synced reviews, sync logs, Pub/Sub events or enabled notification settings. | Complete Google API access/OAuth and Pub/Sub configuration, then test sync and push delivery. |

Google's current prerequisites include managing a verified Business Profile that has been active for more than 60 days and having the business website listed on that profile. The applicant also needs the Google Cloud project number and must submit the Basic API Access application using an email listed as a Business Profile owner/manager. See https://developers.google.com/my-business/content/prereqs.

## Security and data continuity

- Client application uses the Supabase project URL and publishable key; these are not service-role credentials.
- Google OAuth tokens are designed to be encrypted server-side; service keys and Gemini keys must never enter the APK or frontend bundle.
- Never store a workspace pairing code, OAuth secret, Gemini key, database password, service-role key or private SSH key in GitHub source, ZIP files, screenshots or chat.
- Complete handover includes SSH setup instructions and repository remotes only. SSH private keys must be generated and kept on the developer's own device.
- Keep v23 installed while checking v24. Confirm same workspace pairing or restore a verified backup before moving business operations to v24.
- CI success is not manual Android handset testing. Verify PDFs/WhatsApp handoff, notification permissions, cloud sync after offline/online transitions and backup restoration on a real device.

## Release artifacts from main run #223 (historical 2.9.2 baseline)

Workflow: https://github.com/zaid404sec/zaid404sec/actions/runs/44242078227

| Artifact | GitHub Actions artifact ID |
|---|---:|
| Android APK | `14400536100` |
| Windows installer | `14400172286` |
| Application source ZIP | `14400257156` |
| Complete repository / AI handover ZIP | `14399404475` |
| Combined APK + EXE + source + handover package | `14400695730` |

Artifact archives expire under GitHub's retention policy; download and keep a local copy. SHA-256 files are included inside the combined release package.

## Safe release process

Read `AI_HANDOVER/SAFE_CHANGE_RULES.md` before modifying anything. Work from current `main` on a feature branch, make a narrow diff, add regression coverage, pass PR validation, merge only after checks pass, then verify the main build and retrieve its actual artifacts. Update this document, `RELEASE_2.9.3.md` and the handover ZIP after every production release.

Historical 2.8.4 and earlier release notes remain in the repository for traceability; they are not the current app version.
