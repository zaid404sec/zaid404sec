# Prime Auto Care 2.13.4 — Device Access and Booking Decisions

_Last updated: 20 November 2026 (Asia/Kolkata)_

## Purpose

This release replaces the broken second 8-digit booking-notification pairing flow with one Owner-managed five-device allowlist. The existing 64-character workspace pairing credential remains the one-time workspace join credential. It is private and is never included in source archives.

## Approved five-device layout

| Device | Alerts | Accept / Reject | Other booking status changes |
|---|---|---|---|
| Owner Phone | On | Yes | Owner only |
| Dad Phone 1 | Owner enables | No | No |
| Dad Phone 2 | Owner enables | No | No |
| Manager Phone | Owner enables | No | No |
| Manager Laptop | Owner enables | Yes, after Owner grants access | No |

The Owner account retains workspace administration and booking settings. The Manager Laptop is the only non-owner decision-maker. It must be registered as a desktop device and have the exact device name `Manager Laptop`. The server enforces this rule; hiding buttons in the user interface is not the security boundary.

## Device registration and setup

1. Keep the existing Owner Phone signed into the canonical Prime Auto Care workspace.
2. On each of the four additional devices, open Settings → Business Settings → Connect / Pair this device and use the existing private workspace pairing credential once.
3. Open Bookings on each paired device. The API registers it into `pac_booking_device_access`. The Owner Phone is seeded as the first device.
4. On each phone, rename the device to Dad Phone 1, Dad Phone 2 or Manager Phone. On the laptop, name it exactly Manager Laptop.
5. On the Owner Phone, open Bookings → Authorised devices. Enable booking alerts for each intended device.
6. On the Manager Laptop row, grant Accept / Reject. This control appears only for a desktop device named Manager Laptop.
7. On each phone and laptop, enable the operating-system/browser notification permission as well.

The allowlist holds at most five active device identities, including the Owner Phone. The four other devices must be paired and open Bookings before the Owner can approve them. The Owner can revoke a replaced device. Do not delete old workspace memberships or Auth identities as part of this process.

## Security rules enforced by booking-api

- The canonical workspace Owner can always view and manage the device allowlist.
- A non-owner can receive booking alerts only when its active `pac_booking_device_access.notifications_enabled` flag is true.
- A non-owner can Accept or Reject only when `can_decide=true`, `device_type=desktop`, and `device_label=Manager Laptop`.
- The API permits only one non-owner decision-maker. Together with the Owner this means exactly two possible decision-capable identities.
- Non-owner devices cannot complete or cancel bookings. Those operations remain Owner-only.
- Notification acknowledgements are per device. Acknowledging on one phone does not clear the event for another.
- A removed device is immediately denied alerts and decision actions.
- A new device is alert-disabled and decision-disabled until the Owner approves it.
- The server validates all permissions. Client-side buttons are only presentation.

## Database change

Migration: `car-wash-erp/supabase/migrations/20261120150000_booking_device_roles.sql`

It creates `public.pac_booking_device_access`, enables RLS, revokes direct anon/authenticated access, grants server-side service-role access, and seeds the canonical Owner identity as the first authorised device. This is additive and does not reset or reseed business records.

The new allowlist is separate from the historic `washdesk_workspace_members` and `pac_booking_notification_admins` rows. There may be many old anonymous Auth identities in those tables. They are not automatically counted as five physical devices in the new allowlist.

## Notification delivery status

- Booking creation and status transitions continue to create database notification events.
- Supabase Realtime and polling distribute events to signed-in app sessions.
- Android Capacitor local notifications require the app to be running and Android notification permission to be granted.
- Browser/Electron notifications require the manager app/tab to be running and browser/OS permission to be granted.
- Background push while the Android app is fully closed is not yet operational. Firebase Cloud Messaging project configuration, device token registration, server-side sender credentials and end-to-end closed-app tests are still required. Do not claim otherwise.
- SMS and WhatsApp are not included in the free in-app/push design. WhatsApp requires a configured sender and approved template.

## Current public URLs

- Business website: https://prime-auto-care-sigma.vercel.app/
- Customer booking page: https://prime-auto-care-sigma.vercel.app/booking/
- GitHub repository: https://github.com/zaid404sec/zaid404sec
- Website source: `car-wash-erp/website/index.html`
- Customer booking source: `car-wash-erp/website/booking/index.html`
- Vercel project: `prime-auto-care` (`prj_TDEAylEd55OPJKN7oXgI7IoEFNAP`)
- Supabase project ref: `jkjudmkqaebrgllemris`

The two Vercel URLs were previously verified as HTTP 200 with `Content-Type: text/html; charset=utf-8`. The website source did not need a change for this permissions release.

## Owner account and recovery

The Owner phone email contacts supplied for the project are:
- `bmumz3909@gmail.com`
- `mz03200786@gmail.com`

The live canonical Supabase Owner identity is currently an anonymous Auth identity. Do not claim that either email is already linked as its login or recovery email. Verify account ownership and complete a tested email-link/recovery flow before changing authentication. Do not replace the existing Owner identity or delete workspace membership rows.

The previously supplied short PIN is not used as a permanent shared authentication secret. A reusable static PIN across five devices would be weaker than per-device credentials and Owner-controlled revocation. Never include the private workspace pairing credential, API keys, service-role key, FCM service-account JSON, OAuth secrets or Android signing keystore in this handover.

## Build and release

- Application version: 2.13.4
- Android application ID: `com.washdesk.carwash.v24`
- Build instructions: `car-wash-erp/README.md` and repository workflow files in `.github/workflows/`
- Run `npm install`, then `npm run validate` in `car-wash-erp` before packaging.
- Windows build: `npm run dist:win` on Windows with the required build dependencies.
- Android build: follow the repository Android workflow; inspect the resulting APK signing certificate before installation.

The original production Android keystore was not found in the previous handover. If CI outputs a debug-signed APK whose certificate does not match the existing installation, Android will not accept it as an in-place update. Do not uninstall the working app or overwrite its data as a workaround. A production upgrade requires the original signing key or a separately tested migration plan.

## Safe deployment order

1. Review and merge the 2.13.4 source after CI passes.
2. Apply the additive database migration.
3. Deploy the updated `booking-api` Edge Function with the server-side service secrets already configured in Supabase.
4. Verify Owner login, one test device registration, role denial on an ordinary phone, and approval on the Manager Laptop.
5. Verify booking event delivery and independent receipts on all five devices.
6. Confirm that Android closed-app push is still pending until FCM setup and tests pass.
7. Build and package source, APK/EXE, checksums and handover documentation. Keep the old working APK until signing compatibility has been demonstrated.

Do not create fake production customer bookings for QA. Use a controlled test workspace or an explicitly approved test appointment and remove it through the normal Owner workflow after verification.
