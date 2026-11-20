# Prime Auto Care 2.13.6 — Permanent PAC Owner Code and booking-only staff setup

## Owner phone — this same phone
1. Open the app while it is paired to the Prime Auto Care workspace as an Owner.
2. Open **Business Settings**.
3. Find **Permanent PAC Owner Code**. This card appears only for a verified Owner session.
4. Choose an 8–12 digit numeric code and enter it twice.
5. Tap **Save permanent code**. The app stores only a secure hash on the server; the code is not displayed again.
6. Share the code with the staff members who should handle booking decisions. To change it later, repeat these steps on an Owner phone.

Both registered workspace Owners can manage the code from their own Owner session. Device label does not create Owner status.

## Staff phone or laptop
1. Open **Bookings**.
2. Choose a device label: Dad Phone, Zaid Phone, Jack Phone or Manager Phone.
3. Choose **Mobile** or **Laptop**.
4. Choose **Member** under Access type.
5. Enter the permanent PAC Owner Code.
6. Tap **Verify code & Connect**.

The device is connected immediately. There is no pending request and no Owner approval prompt.

## Permissions
- Owner accounts retain all business modules, business data, booking settings, code management and device removal.
- PAC-code staff devices can open only the Bookings screen.
- Staff can view bookings, receive booking alerts, acknowledge their own alerts, and Accept or Reject bookings.
- Staff cannot create staff bookings, create invoices, view the business sync snapshot, change booking settings, edit business records, change the PAC Owner Code, or remove devices.
- The Owner can remove a staff device from **Business Settings → Connected staff devices**.
- Up to four staff devices can be connected in addition to the Owner phone (five total). One distinct workspace member account is used for each registered staff device.

## Code format and recovery
The Owner chooses an 8–12 digit numeric code. It remains active until the Owner replaces it. Replacing the code blocks future use of the old code; already connected staff devices remain active until the Owner removes them. Incorrect attempts are rate-limited. If the code is forgotten, set a new one from Business Settings on an Owner phone.

## Security and data
The code grants booking-only staff membership. It never promotes anyone to Owner. Staff devices do not download or sync the full business database. Server-side policies restrict business-data reads and writes, while the booking API independently restricts staff actions to Accept/Reject and alert acknowledgement.

## Android installation note
The 2.13.6 CI APK uses the package ID `com.washdesk.carwash.v26` and a CI debug signing key. It installs side-by-side with earlier debug builds. The original production keystore was not supplied, so this build cannot be guaranteed to install as an in-place update over an APK signed with a different key. Keep the previous app and backup until the new build is validated.
