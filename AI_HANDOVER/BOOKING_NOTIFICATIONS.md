# Prime Auto Care — Five-Device Booking Access and Notifications

_Last updated: 20 November 2026 (Asia/Kolkata)_

## Intended device roster

The production Prime Auto Care workspace has one Owner Phone and four additional device slots:

| Device | Default access | Booking decisions |
|---|---|---|
| Owner Phone | Alerts + full workspace administration | Accept, Reject, Complete, Cancel, settings and device management |
| Dad — Phone 2 | Booking alerts | No |
| Dad — Phone 3 | Booking alerts | No |
| Manager — Phone 4 | Booking alerts | No |
| Manager Laptop | Booking alerts | Accept and Reject pending bookings only |

The Owner Phone is always the canonical Workspace Owner. The Manager Laptop is the only additional device that may be granted Accept/Reject permission. A Manager Laptop cannot complete or cancel bookings or change public booking settings.

## Authentication and pairing

There are two separate steps:

1. **Workspace pairing** connects an installation to the shared Prime Auto Care workspace. Use the existing private workspace pairing credential from Settings → Business Settings → Connect / Pair this device. Never put this credential in source, ZIP files, screenshots, chat messages or public documentation.
2. **Booking-device approval** is an Owner-controlled allowlist for notifications and booking decisions. It does not change the workspace Owner, membership role, customers, invoices or bookings.

There is no new shared permanent 8-digit booking PIN. A shared permanent PIN would be easy to forward, reuse or leak. Each installation retains its own authenticated workspace identity. The Owner approves the device identity once and can revoke it later.

The conversation-supplied number `26102005` is not stored, embedded or used as an authentication credential. It appeared in chat and must not be reused as a permanent password.

## Device registration flow

1. Pair the phone or laptop with the existing Prime Auto Care workspace.
2. Open Bookings and refresh.
3. On the new device, enter a clear device label (for example, `Dad Phone 2`, `Manager Phone` or `Manager Laptop`), select Phone or Desktop, and choose **Request device access**.
4. The request appears in the Owner Phone's Bookings → Five authorised devices panel.
5. The Owner approves a phone for alerts only.
6. For the Manager Laptop, the Owner may select **Approve + Accept / Reject**. The backend permits at most one additional decision-capable device, and that device must be registered as Desktop.
7. The Owner can revoke a device. A revoked device stops receiving booking alerts and cannot change booking status.

The backend enforces a maximum of five active devices for the workspace, including the Owner Phone. Pending requests do not receive alerts. Old workspace member identities are not automatically counted as approved booking devices.

## Booking decision enforcement

- Owner: full booking authority.
- Approved Manager Laptop: only `confirmed` (Accept) and `rejected` (Reject) transitions.
- Other authorised phones: view and acknowledge alerts only.
- All other accounts/devices: no booking alert stream and no status-change permission unless the Owner explicitly enrols them.

The API verifies the signed-in workspace identity and the approved device record on every notification read, acknowledgement and status change. Hiding a button in the UI is not the security boundary; the backend enforces the same restriction.

## Shared notification delivery

One booking event is stored once. Each active device receives its own copy of the unread event stream. Acknowledging an event on one device does not clear it on another device.

Current notification paths:
- Android: Capacitor Local Notifications while the app runtime is active and Android notification permission is granted.
- Manager Laptop: browser/Electron Web Notifications while the application is running and OS/browser permission is granted.
- Database/Realt ime: Supabase booking event records, realtime notification and a polling fallback.

### Closed-app delivery limitation

Reliable push while Android is fully closed is not active yet. It requires a Prime Auto Care Firebase project, FCM app configuration, secure server-side service-account credentials, per-device push token registration and revocation, a server-side sender, and real-device end-to-end tests. Desktop closed-browser Web Push also requires a service-worker subscription and VAPID server credentials. Do not describe closed-app delivery as operational until tested.

No SMS or WhatsApp notification sender is included in this free push design. WhatsApp requires a configured provider and approved template.

## Production preservation rules

- Do not reset or reseed the workspace.
- Do not delete existing anonymous Auth identities solely because the historical member count is larger than five.
- The new booking-device allowlist is separate from the legacy workspace-membership and notification-admin tables.
- Preserve booking rows, notification events and per-device receipts.
- Never include service-role keys, project secrets, push credentials, workspace pairing credentials, keystore files or passwords in release packages.
