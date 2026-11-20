# Prime Auto Care 2.13.8 — Owner restore and staff pairing

## Owner sign-in troubleshooting

The Owner restore screen uses the registered Supabase Auth email and that same account's Supabase Auth password. The password must belong to the email selected in the dropdown.

Do not enter either of these in the Owner password field:
- The 8–12 digit PAC Owner Code used to connect staff booking devices.
- The old 64-character workspace pairing key.

If the app reports **Invalid login credentials**, Supabase rejected the email/password before the app checked the Owner workspace role. Running Cloud Sync SQL again cannot reset or repair a Supabase Auth password. Select the matching Owner email and enter its current password. If the password is no longer known, the project administrator must recover/update that existing user's password through Supabase Authentication; do not delete the user or workspace membership.

The 2.13.8 hotfix shows the actual Owner email addresses, gives separate guidance for the credentials, and clears the lingering “Signing in…” status after a failed attempt. A failed sign-in does not delete the locally saved business data.

## Restore the full Owner app

1. Install Prime Auto Care 2.13.8.
2. Open **Business Settings → Shared Cloud Database**.
3. Select the Owner email whose password you will enter.
4. Enter that account's existing Supabase Auth password.
5. Tap **Sign in as Owner & restore full business app**.
6. The server checks the account's existing Owner membership. Only an account already marked Owner is allowed to restore the full business app.
7. The app loads the canonical shared business snapshot and resumes cloud sync.

Both registered Owner accounts remain eligible. No approval from the other Owner is required.

## Connect a staff phone or laptop

1. Open Bookings → Booking device access.
2. Select Dad Phone, Zaid Phone, Jack Phone or Manager Phone.
3. Select Mobile or Laptop.
4. Select Member.
5. Enter the permanent PAC Owner Code from the Owner.
6. Tap **Verify Code & Connect**.
7. Enable system notifications on the device.

Staff can view bookings and Accept/Reject them. Staff cannot open the rest of the business modules, alter business settings or records, change the PAC Owner Code, or remove connected devices.

## Code management on the Owner phone

After Owner sign-in, open **Settings → Permanent PAC Owner Code**. The Owner creates/changes the 8–12 digit code there. The code is stored as a server-side SHA-256 hash and is used only to enrol staff booking devices.

## Important distinction

- Owner email/password: restores full business application access on the Owner phone.
- PAC Owner Code: connects staff to Bookings and Accept/Reject only.
- Legacy 64-character workspace pairing key: not the normal way to restore the Owner's phone on an existing workspace.

## Data and installation

The update does not intentionally delete local or cloud records. The 2.13.8 CI build uses package ID `com.washdesk.carwash.v28`; it installs alongside the 2.13.7 debug-signed build because the original production signing keystore was not supplied. Keep the previous installation until the new Owner app has signed in and invoices, customers, expenses, staff, stock and other records have been verified.
