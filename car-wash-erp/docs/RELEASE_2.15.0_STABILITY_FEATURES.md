# Prime Auto Care 2.15.0 — stability and operations release

## Release scope

This release builds on 2.14.3 and keeps the existing Prime Auto Care Supabase workspace and JSON sync snapshot. It is a source/app update; it is not a database reset.

### Cloud sync stability
- Supabase Realtime remains the primary change-delivery path.
- The safety reconciliation checks only `washdesk_sync.updated_at` every 120 seconds, and downloads the full JSON payload only when the server timestamp changes.
- The last successfully synced payload is compared using stable key ordering; unchanged snapshots are skipped before the RPC upload.
- Writes are coalesced behind a 1-second debounce. The app keeps one latest snapshot reference instead of cloning the full database on every local save.
- Foreground reconciliation is registered through one removable visibility listener, avoiding duplicate listeners after repeated resume events.
- Remote updates continue to defer while a bill form, input, or modal is active.

### Invoices and vehicles
- The invoice field is Vehicle name / model rather than odometer.
- Invoices support multiple assigned staff IDs and store a staff-name snapshot so old invoices still display the team if staff names change.
- Invoice list filters include Paid, Pending / Partial, Partial only and Cancelled, with exact-date and month filters.
- Today's Paid and Pending cards show bill counts and collected / outstanding amounts.
- Invoice editing retains invoice number, recalculates totals and stock usage, and supports multiple staff assignments.
- The 4+1 loyalty scheme is tracked per saved vehicle. The fourth completed bill announces that the next visit is free; the fifth visit is complimentary with zero payable. The customer-vehicle view provides an ON/OFF control per vehicle.
- Complimentary invoices keep their service lines and show the full complimentary discount, zero taxable amount, zero tax and zero grand total. Stock usage is still recorded for the service.

### Public bookings and completion
- The public booking page shows a large receipt modal with a clear PENDING status and a booking reference.
- The browser prevents rapid identical re-submission in the same tab session; the booking API also reuses an identical pending booking for the same phone, vehicle, service, date and time within ten minutes.
- Completing a booking opens a completion form for customer, phone, vehicle, service, bill total, amount received, payment mode and multiple staff.
- Booking completion saves/finds the customer and vehicle, creates one invoice linked to the booking, and does not intentionally create a second invoice on a retry.
- Accept / Reject actions save the booking decision, prepare a customer WhatsApp message, and generate a booking decision PDF where the PDF engine is available.
- Accepted messages include the confirmed slot and the instruction to arrive 10–15 minutes early; they explain that late arrivals may lose the slot.
- Rejection requires a reason and the reason appears in the prepared message.

### Staff timekeeping and salary
- Attendance can be recorded in stages: check-in, lunch start, lunch end and check-out.
- Previously saved times remain when a later time is entered.
- Worked hours subtract lunch; overtime is calculated against the staff member's scheduled shift.
- An extra-work bonus can be recorded per staff/day and is included in the payroll / salary calculation.
- Advanced staff statements include daily times, lunch, work hours, overtime and extra-work bonus and are available for PDF and Excel export.

## Important external-service limits

These are not represented as complete or verified in this release:

1. **Closed-app push alerts:** Current booking alerts use the app's local notification permission and in-app/realtime event processing. A phone that fully force-closes the app cannot reliably receive a new server event without a configured push service such as Firebase Cloud Messaging (FCM), Android Firebase configuration and server credentials. Those credentials/configuration were not available in this source update; therefore instant notification while fully closed is not claimed.
2. **WhatsApp delivery:** Accept / Reject currently opens a prefilled WhatsApp conversation. The Owner must review and press Send. It does not send automatically. Booking PDFs are saved to Downloads when supported; they must be attached manually in WhatsApp. Automatic send-and-attach requires an approved WhatsApp Business Cloud API sender, templates and credentials.
3. **Production end-to-end checks:** CI validates the app source and builds. A real-device test is still required for APK install, two-device cloud sync, public booking through the live hosted site, Android notifications, PDF save/share, and WhatsApp delivery.
4. **Android signature:** Unless the original production keystore is configured in CI, the APK is debug-signed and uses package ID `com.washdesk.carwash.v33` to install alongside the previous app. Export an app backup before testing; do not uninstall the old app until records are verified.

## Source map

- `index.html` — SPA, billing, invoices, customer/vehicle records, loyalty, staff screens, booking completion UX and report entry points.
- `src/cloud-sync.js` — Supabase Auth, workspace mapping, realtime sync, write coalescing and fallback reconciliation.
- `src/report-export.js` — PDF / Excel export helpers.
- `src/local-notifications.js` — local notification permissions and device-local notifications; not a replacement for FCM.
- `src/bookings.js` and `supabase/functions/booking-api/index.ts` — booking API client and public/owner booking backend.
- `website/booking/index.html` — public booking form and large pending confirmation receipt.
- `supabase/functions/google-review-api/index.ts` and `google-review-oauth-callback/index.ts` — Google Reviews API and current workspace Owner role checks.
- `scripts/validate-app.mjs` — pre-build validation checks.

## Data protection

No user, workspace, business record or canonical `washdesk_sync.user_id` was deleted or re-keyed by this source release. No new database schema migration is required for the features above; new invoice/attendance fields are stored in the existing synced JSON payload. Continue to export a backup before upgrading and keep the previous app until the new one has been tested.
