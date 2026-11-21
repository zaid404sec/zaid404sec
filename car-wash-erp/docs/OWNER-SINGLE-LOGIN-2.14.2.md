# Prime Auto Care 2.14.3 — single permanent Owner login

Date: 21 November 2026 (Asia/Kolkata)

## Objective

Replace the confusing two-Owner email selector with one fixed Owner email and one password. A successful sign-in with the registered primary account grants full Owner access on that installation, including shared business sync and booking Accept/Reject. The Owner does not need a separate pairing code or device approval.

## Single Owner identity

- Existing verified primary email: `primeautoconsult@gmail.com`.
- The app shows this email as a fixed, read-only username; the user enters one password.
- The second former Owner identity is no longer in the app allowlist and has been changed to workspace role `member`; its booking-notification admin grant has been revoked.
- The legacy anonymous snapshot identity remains as the canonical `washdesk_sync.user_id` storage key, but is demoted to `member`, and its old Owner booking-device authority is revoked.
- Do not delete Auth records or change `washdesk_workspaces.owner_auth_user_id`. Those identities and pointers are retained for data integrity.
- Anyone who knows the one Owner email and password can administer the full business workspace. Do not share those credentials with staff.

## Authentication status

The source now accepts only the primary Owner email. The new email is not yet present in Supabase Auth. To preserve the current Owner UUID and role, edit the existing Owner Auth user in the Dashboard: change its email to `primeautoconsult@gmail.com`, set a password, and confirm the email. Login is not verified until a real `signInWithPassword` test returns a session.

Do not embed the password, a master login token, a service-role key or any reset secret in the APK, source repository, GitHub Actions logs, or handover ZIP.

## Database changes

- `20261121102050_prime_auto_care_single_owner_login_20261121.sql`: makes the primary email the sole workspace Owner; demotes the former secondary email and revokes its notification-admin grant.
- `20261121102515_disable_legacy_anonymous_owner_login_20261121.sql`: demotes the legacy anonymous Owner membership and revokes its old booking-device authority without moving the canonical business snapshot.
- The role-based shared snapshot and invoice-numbering functions remain in place. Only a workspace member with `role='owner'` can write business data or allocate invoice numbers.

## Application changes

- App version: 2.14.3.
- Android package ID: `com.washdesk.carwash.v32` (side-by-side installation).
- The Owner login UI contains one read-only email field and one password field.
- `REGISTERED_OWNER_EMAILS` contains only the primary Owner email.
- The service-worker cache is bumped to `prime-auto-care-shell-v37`.
- Existing billing, invoices, customers, inventory, expenses, payroll, booking, website and customer booking functionality are retained.
- Staff booking alert and pairing capabilities remain separate from the full Owner login.

## Release / installation

The CI workflow must pass the app validator, Android APK, Windows installer, Edge Function type checks and complete release packaging. The Android CI APK is debug-signed and uses the v32 package ID; it installs alongside the prior application. Keep the previous APK and its local records until the new app is connected, shared data is visible and backups are checked.

## Acceptance tests

1. Enter the fixed primary email and updated password on a fresh 2.14.3 installation.
2. Confirm the server returns workspace role `owner`.
3. Confirm cloud data restores and a new customer/invoice syncs in both directions between two 2.14.3 installations.
4. Confirm booking notification access and Owner Accept/Reject work without an additional device approval.
5. Confirm the former secondary email and legacy anonymous identity do not receive Owner privileges.
6. Confirm staff accounts remain non-Owner.


## Password handling

The password supplied in chat is not embedded in source, APK, EXE, release artifacts, or CI logs. Because it was disclosed in chat, use a fresh, stronger password when setting the account. Normal login is direct email+password; no email-link login or reset link is required.
