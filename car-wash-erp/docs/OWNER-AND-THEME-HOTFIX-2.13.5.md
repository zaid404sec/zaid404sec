# Prime Auto Care 2.13.5 Owner + Theme Hotfix

## Owner authorization
The Prime Auto Care workspace has two Owner memberships:
- `bmumz3909@gmail.com`
- `mz03200786@gmail.com`

The booking API now authorizes a signed-in member by the verified workspace membership role (`owner`), rather than additionally requiring the member's auth user ID to equal a single legacy `owner_auth_user_id`. Both Owners can manage booking settings and Accept/Reject bookings. A second Owner is not asked to approve the first Owner's action. Non-Owner members retain their existing restricted permissions.

## Booking decision integrity
The existing database transaction RPC `pac_update_booking_status_and_notify` remains the booking status transition path. It continues to provide status transition validation, actor attribution, conflict handling and notification-event creation. The existing authorised-device booking alert workflow and five-device limit remain in place. Alert acknowledgement by a non-Owner does not change booking status.

## Appearance
Settings include an Appearance selector for Dark mode and Light mode. The preference persists per device using local storage and defaults to Dark mode on first launch.

## Existing business functionality
The update retains the existing Prime Auto Care website, customer booking page, business records, customers, invoices, reports, inventory, staff, cloud synchronization and other existing modules. No replacement application or redesigned booking flow is introduced.

## Android installation compatibility
The CI build uses package ID `com.washdesk.carwash.v25`. This intentionally installs side-by-side with the older `com.washdesk.carwash.v24` app because the original production signing key was not present in the supplied handover, and the CI APK is debug-signed. Keep the previous app installed until the new app has been signed into the same workspace and the records are confirmed. Export a local backup before changing installations, especially where local-only data exists.

## Notification scope
The existing device-specific notification permission and acknowledgement flow is retained. Android local notifications require notification permission and app runtime availability. Browser/Electron notifications require the manager app to be running and notification permission to be granted. Fully closed-app Firebase Cloud Messaging push delivery has not been configured or verified in this release; it must not be represented as guaranteed.

## Live backend and owner membership
- Supabase project: `jkjudmkqaebrgllemris`.
- Booking API hotfix: deployed version 19.
- Both configured Owner accounts were verified as workspace members with the `owner` role.

## Public endpoints retained
- Business website: https://prime-auto-care-sigma.vercel.app/
- Customer booking: https://prime-auto-care-sigma.vercel.app/booking/
- Supabase website function: https://jkjudmkqaebrgllemris.supabase.co/functions/v1/prime-auto-care-site/

## Build validation
The 2.13.5 release pipeline runs the project validator, Android APK build, Windows installer build and backend TypeScript checks. Build artifacts are considered deliverable only after the relevant workflow jobs succeed and the downloaded artifact archives pass integrity checks.
