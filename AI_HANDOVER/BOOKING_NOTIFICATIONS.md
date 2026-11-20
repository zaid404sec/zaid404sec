# Prime Auto Care — Booking Notifications and Device Enrolment

_Last verified: 20 November 2026 (Asia/Kolkata)_

## Goal

All four authorised phones and the manager laptop must use the same Prime Auto Care workspace and be eligible to receive new booking and booking-status alerts. Do not reset or reseed existing business data to enrol devices.

## Current access model

There are two separate concepts:

1. **Workspace membership** allows a device to use the shared business database and booking desk.
2. **Workspace Owner** is a separate role used for Owner-only settings and administrative actions.

The current app uses anonymous Supabase Auth sessions. Each installation/device can have its own anonymous Auth identity. A device is not automatically the Owner just because it belongs to the business.

### Connecting a device

For each additional phone or laptop:

1. Open the app.
2. Go to Settings → Business Settings → Connect / Pair this device.
3. Enter the existing private 64-character Prime Auto Care workspace pairing credential.
4. Complete the shared cloud sync handshake.
5. Open Bookings and refresh.

Do not paste the workspace pairing credential into source code, GitHub, public messages, screenshots or handover archives. It is a workspace join secret and can grant access to shared business data.

The currently connected Owner device should remain signed in. Do not uninstall it, clear its app/WebView storage or sign out unless a separate Owner recovery method has been verified.

## Booking alert enrolment

The previous UI required a second 8-digit one-time code to enable booking alerts. This caused confusion because devices had to join the workspace first, and only then could they redeem the notification code.

The 2.13.3 redesign removes that second step:

- Any authenticated member of the Prime Auto Care workspace is automatically enrolled for booking alerts.
- New/re-paired members are enrolled by trigger `pac_auto_enrol_workspace_member_for_booking_alerts`.
- Existing members were backfilled by migration `20261120130000_workspace_members_auto_booking_alerts.sql`.
- The old one-time code tables and API actions remain for backwards compatibility, but the normal UI no longer displays the Generate/Authorise 8-digit panel.
- The 8-digit number `26102005` supplied during the conversation is **not** used as a shared password, owner credential or pairing code. It was exposed in conversation and is not a suitable permanent secret.

### Live permission verification

Latest database check:
- Workspace members: 36
- Active booking-alert permission rows: 36
- Existing Owner identity: preserved
- Existing Owner role: `owner`
- Existing bookings, invoices, customers and business records: not reset

The count of 36 is a count of Auth/workspace identities, not a verified count of physical devices. Older anonymous identities created during repeated installs may remain. Do not remove them until the Owner can identify the intended four phones and manager laptop.

The booking API v13 adds these fields to the authenticated booking list response:
- `permissions.is_owner`
- `permissions.notifications_enabled`
- `permissions.notification_device_count`

## Notification delivery paths

### Android phones

The app uses Capacitor Local Notifications. A user-triggered control called **Enable notifications on this device** checks/requests Android notification permission. When the app is active and connected, it polls booking events and can schedule a local Android notification.

### Manager laptop

The app uses the browser/Electron Web Notifications API. The manager must press **Enable notifications on this device** and allow notifications in the browser/OS permission prompt. This supports the app while it is running.

### Fully closed/background delivery — not yet active

A database event and Supabase Realtime subscription do not guarantee notification delivery after Android suspends or closes the app's JavaScript runtime.

Reliable delivery while the Android app is fully closed still requires:
- A Firebase project controlled by Prime Auto Care.
- Firebase Cloud Messaging configuration for the Android application ID `com.washdesk.carwash.v24`.
- A secure service-account credential stored server-side (never in the APK, GitHub or this file).
- Per-device FCM token registration and revocation.
- A server-side push sender invoked when a booking notification event is written.
- End-to-end tests on all four phones, including the app open, backgrounded, force-closed, offline and restored cases.

For browser/PWA closed-window push, a Web Push service-worker subscription and VAPID server credentials are also required. The current desktop Web Notification path should not be represented as closed-window push delivery.

Do not tell the Owner that fully closed-app alerts are operational until the provider configuration and real-device delivery tests pass.

## Booking event and receipt flow

1. The customer booking page requests live availability.
2. The API validates the booking and the database enforces slot overlap/capacity.
3. A successful public request is stored as Pending.
4. A booking-created event is recorded.
5. Workspace-authorised devices retrieve the event through the booking API and/or Supabase Realtime.
6. A device displays a local/browser notification where supported and permission is granted.
7. Each device records its own acknowledgement in `pac_booking_notification_receipts`.

Acknowledging an event on one phone must not hide it on another phone. The per-device receipt table and unique key are retained for this purpose.

## Current source locations

| Path | Purpose |
|---|---|
| `car-wash-erp/index.html` | Bookings UI, permission control, polling and status actions |
| `car-wash-erp/src/bookings.js` | Authenticated booking API client |
| `car-wash-erp/src/cloud-sync.js` | Anonymous device session and workspace pairing |
| `car-wash-erp/src/local-notifications.js` | Android Local Notifications and desktop Web Notifications |
| `car-wash-erp/supabase/functions/booking-api/index.ts` | Workspace auth, booking API, notification reads and per-device receipts |
| `car-wash-erp/supabase/migrations/20261119043635_booking_notification_admin_access.sql` | Server-only booking notification permissions |
| `car-wash-erp/supabase/migrations/20261119085155_booking_multi_device_notifications_20261119.sql` | One-time notification pairing and per-device receipts (legacy UI flow retained only for compatibility) |
| `car-wash-erp/supabase/migrations/20261120130000_workspace_members_auto_booking_alerts.sql` | Automatic booking alert enrolment for workspace members |
| `car-wash-erp/scripts/validate-app.mjs` | Regression checks for booking and notification behavior |

## Safe-change rules

- Do not reset the production Supabase project, workspace, sync row or business tables.
- Do not change `owner_auth_user_id` or promote/demote members without explicit approval and a verified recovery path.
- Do not place workspace pairing credentials, user-supplied PINs, service-role keys, FCM service-account JSON, OAuth tokens or Android signing keystores in Git.
- Do not make a short 8-digit number the permanent shared workspace credential. Eight digits are suitable only for short-lived, rate-limited one-time challenges.
- Do not globally acknowledge booking events. Receipts are per device.
- Do not claim closed-app push is working based only on successful database event creation, Realtime logs or foreground notification tests.
- Keep the original Android package ID `com.washdesk.carwash.v24`. The available CI APK remains debug-signed; a production-signed update requires the original keystore or a separately verified migration strategy.
