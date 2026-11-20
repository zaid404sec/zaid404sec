# Prime Auto Care 2.13.7 — Owner restore and staff pairing

## Why the previous screen hid the business features
The older 64-character workspace key creates an anonymous workspace session. On an already-existing workspace, a fresh anonymous identity is a Member, so the app correctly limited that identity to Bookings. It was the wrong connection method for restoring the Owner's phone.

## Restore the full Owner app on the Owner's phone
1. Install 2.13.7 and open Prime Auto Care.
2. Open **Business Settings → Shared Cloud Database**.
3. Select the registered Owner email account.
4. Enter that account's existing password in the app. Do not send the password in chat.
5. Tap **Sign in as Owner & restore full business app**.
6. The server checks the account's existing Owner membership. Only an account already marked Owner is allowed to restore the full business app.
7. The app loads the canonical shared business snapshot, enables full Owner navigation and resumes cloud sync.

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
- Legacy 64-character cloud pairing key: not the normal way to restore the Owner's phone on an existing workspace.

## Data and installation
The update does not intentionally delete local or cloud records. Keep the old installation until the new Owner app has signed in and you have verified that invoices, customers, expenses, staff, stock and other records are visible. The 2.13.7 CI build uses package ID `com.washdesk.carwash.v27`; it installs alongside earlier debug-signed builds because the original production signing keystore was not provided.
