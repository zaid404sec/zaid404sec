# Prime Auto Care 2.13.6 — Simple device pairing guide

## Owner phone
1. Sign in with either registered Owner account.
2. Open Bookings → Device Setup.
3. Tap **Generate pairing code**.
4. Share the displayed 8-digit code with one member device.
5. The code expires in 10 minutes and can be used once.

## Dad Phone / Member
1. Sign in to the existing Prime Auto Care workspace with the member account.
2. Open Bookings → Device Setup.
3. Select **Dad Phone — alerts only** or **Member**.
4. Enter the 8-digit code.
5. Tap **Verify code**.
6. If accepted, booking alerts are enabled for that account.

## Owner
Owner Phone and Owner account options require a valid Owner account sign-in. Pairing codes cannot upgrade a Member to Owner.

## Not sure
Select Not sure to display help that explains the difference between Owner sign-in and Member alert pairing.

## Security scope
Pairing codes are hashed server-side, one-time, and expire after 10 minutes. Redeeming the code grants booking-alert access only. It does not grant booking Accept/Reject decisions. Those remain restricted to Owner accounts (and the existing separately authorised manager role, where applicable).

## Existing features
Website, customer booking page, bookings, customers, invoices, reports, inventory, staff, cloud sync and persistent Dark/Light setting are retained.

## Android
This CI APK is debug-signed and uses package ID `com.washdesk.carwash.v26`. It installs side-by-side with the previous app. Keep the prior app until you confirm records are visible in the updated app. The original signing keystore was not included in the handover; do not send keystore passwords or private signing keys in chat.
