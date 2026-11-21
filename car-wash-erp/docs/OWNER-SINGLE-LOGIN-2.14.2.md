# Prime Auto Care 2.14.2 — single permanent Owner login

Date: 21 November 2026 (Asia/Kolkata)

## Objective

Replace the confusing two-Owner email selector with one fixed Owner email and one password. A successful sign-in with the registered primary account grants full Owner access on that installation, including shared business sync and booking Accept/Reject. The Owner does not need a separate pairing code or device approval.

## Single Owner identity

- Existing verified primary email: `bmumz3909@gmail.com`.
- The app shows this email as a fixed, read-only username; the user enters one password.
- The second former Owner identity is no longer in the app allowlist and has been changed to workspace role `member`; its booking-notification admin grant has been revoked.
- The legacy anonymous snapshot identity remains as the canonical `washdesk_sync.user_id` storage key, but is demoted to `member`, and its old Owner booking-device authority is revoked.
- Do not delete Auth records or change `washdesk_workspaces.owner_auth_user_id`. Those identities and pointers are retained for data integrity.
- Anyone who knows the one Owner email and password can administer the full business workspace. Do not share those credentials with staff.

## Authentication status

The source now accepts only the primary Owner email. The connected Supabase tools did not provide the Auth Admin password-reset operation in this run, so the new password has **not** been applied to Supabase Auth. The currently stored password may still be different from the newly generated password provided privately to the Owner. Do not claim live login succeeds until the password is updated for this existing Auth user and a real `signInWithPassword` test returns a session.

Do not embed the password, a master login token, a service-role key or any reset secret in the APK, source repository, GitHub Actions logs, or handover ZIP.

## Database changes

- `20261121102050_prime_auto_care_single_owner_login_20261121.sql`: makes the primary email the sole workspace Owner; demotes the former secondary email and revokes its notification-admin grant.
- `20261121102515_disable_legacy_anonymous_owner_login_20261121.sql`: demotes the legacy anonymous Owner membership and revokes its old booking-device authority without moving the canonical business snapshot.
- The role-based shared snapshot and invoice-numbering functions remain in place. Only a workspace member with `role='owner'` can write business data or allocate invoice numbers.

## Application changes

- App version: 2.14.2.
- Android package ID: `com.washdesk.carwash.v31` (side-by-side installation).
- The Owner login UI contains one read-only email field and one password field.
- `REGISTERED_OWNER_EMAILS` contains only the primary Owner email.
- The service-worker cache is bumped to `prime-auto-care-shell-v37`.
- Existing billing, invoices, customers, inventory, expenses, payroll, booking, website and customer booking functionality are retained.
- Staff booking alert and pairing capabilities remain separate from the full Owner login.

## Release / installation

The CI workflow must pass the app validator, Android APK, Windows installer, Edge Function type checks and complete release packaging. The Android CI APK is debug-signed and uses the v31 package ID; it installs alongside the prior application. Keep the previous APK and its local records until the new app is connected, shared data is visible and backups are checked.

## Acceptance tests

1. Enter the fixed primary email and updated password on a fresh 2.14.2 installation.
2. Confirm the server returns workspace role `owner`.
3. Confirm cloud data restores and a new customer/invoice syncs in both directions between two 2.14.2 installations.
4. Confirm booking notification access and Owner Accept/Reject work without an additional device approval.
5. Confirm the former secondary email and legacy anonymous identity do not receive Owner privileges.
6. Confirm staff accounts remain non-Owner.
