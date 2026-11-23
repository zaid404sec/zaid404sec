# Prime Auto Care 2.15.0 — Release and Operations Handover

Date: 23 November 2026  
Application: Prime Auto Care / WashDesk  
Android package: `com.washdesk.carwash.v33`  
Desktop target: Windows x64 NSIS installer  
Supabase project: `jkjudmkqaebrgllemris`

## Release scope

### Cloud sync and stability
- Replace periodic full-payload refresh with a 15-second timestamp-only `updated_at` check.
- Do not subscribe to the `washdesk_sync` row through Postgres Realtime; each such event broadcasts the full shared JSON snapshot.
- Fetch the snapshot only when the timestamp changes. Booking notification events remain on their dedicated Realtime table.
- Pause revision polling while the app is hidden or offline, reconcile on foreground, serialize and compare the local payload before writing, and skip unchanged snapshots.
- This reduces redundant transfers and rendering. It is not a normalized per-record/delta synchronization design; a genuine business edit still sends the shared snapshot through the merge RPC.

### Billing and invoice editing
- Remove the Odometer field from billing; use Vehicle name/model.
- Allow multiple staff members on a single invoice and preserve all selected staff IDs in invoice editing, invoice preview/PDF and history.
- Add Paid, Pending/partial and date filters. Show today's paid and pending counts and amounts alongside filtered totals.
- Preserve invoice editing, payment history edits, cancellation audit/stock reversal and shared invoice numbering.
- Keep invoice customer, registration and payment records linked. Do not migrate or delete old invoice data as part of this UI update.

### Public bookings and booking completion
- Display a large, explicit Pending Request confirmation modal after a successful public booking, including its reference and requested date/time.
- Disable repeated form submission while a request is in flight and store a short-lived same-browser duplicate guard.
- At the API, reuse a matching recent pending request (same mobile hash, vehicle registration, date and start time; 10-minute window) instead of creating a second booking notification.
- Accept/reject prepares a customer-facing decision PDF and WhatsApp message. Acceptance states the slot and asks the customer to arrive 10–15 minutes early; late arrival may mean the slot is reassigned. Rejection includes the reason.
- Complete opens a service/payment/staff form, creates or links the customer and vehicle, saves the invoice and any payment entry, then marks the booking complete. A sourceBookingId guard prevents an additional invoice for the same booking.

### Vehicle service loyalty
- Count fully paid services by customer vehicle/registration, not by customer alone.
- After four qualifying paid visits, prompt the Owner to apply one complimentary service on the fifth visit.
- Store the reward on the invoice so the visit cycle resets after a reward.
- Add a per-vehicle Enable/Disable offer control. Complimentary, cancelled or partly unpaid invoices do not qualify.
- Add the fourth-visit eligibility and fifth-visit reward wording to the invoice WhatsApp message when appropriate.

### Staff attendance and payroll
- Store Time In, Time Out, Lunch Start and Lunch End per staff member and date.
- Saving Time In first and Time Out later must preserve the earlier saved value.
- Subtract the lunch interval from worked hours and calculate overtime against the configured shift end.
- Record an approved overtime bonus and add it to earned salary/payroll calculations.
- Export an advanced staff PDF containing daily attendance times, lunch, hours, overtime hours, overtime bonus, salary and advances.

## Production integrations not yet verified

### Android notifications while the app is fully closed
The existing booking event channel and local notification path do not by themselves guarantee push while Android is fully closed. Full background push requires a Firebase Cloud Messaging project, `google-services.json`, Android push setup, device-token registration and a server-side sender. These credentials were not present in the source handover at the time of this release. Do not claim closed-app push is operational until configuration and physical-device testing are completed.

### Automatic WhatsApp delivery
The booking-decision and invoice flows prepare messages and PDF attachments for WhatsApp handoff. The user must review the recipient and press Send. Fully automatic Meta Cloud API delivery requires the business WABA ID, Phone Number ID, access token and approved utility templates, none of which were configured in the live communications settings during this release. Do not claim automatic sending is active.

## Build and test status

A successful CI build proves that the APK/EXE packages compile and the repository validation/type checks pass. It does not substitute for testing on the Owner phone, a second authorised device, a customer booking browser and a Windows installation.

Recommended acceptance tests:
1. Compare Supabase query/log volume while idling on Dashboard; verify no full snapshot downloads when `updated_at` is unchanged.
2. Edit a record on Device A; verify Device B receives the new revision after the timestamp changes, without rendering over active form edits.
3. Create/edit a bill with 2–3 assigned staff and a vehicle model; save PDF; edit it; verify all staff and model persist.
4. Filter invoices by Paid/Pending and date; confirm today's counts and amounts against payment entries.
5. Submit one public booking; verify the large Pending modal. Submit the same details from a second tab within 10 minutes; verify only one pending booking/alert is created.
6. Confirm/reject from the Owner desk; verify decision PDF text, WhatsApp handoff and slot/reason information.
7. Complete a booking; verify customer, vehicle, service, invoice, payment mode/amount, multiple staff and completed status.
8. Test the fourth paid visit, fifth-visit free-service prompt, invoice message and per-vehicle offer disable control.
9. Save attendance in two stages (morning In, evening Out), record lunch and overtime bonus, and export the advanced PDF.
10. Test backup/restore and offline-to-online sync before relying on the new release for live billing.

## Data preservation
This release does not drop/reset business tables. Keep the existing workspace, bookings, customers, vehicles, invoices, stock and staff records. The canonical business snapshot remains keyed by the established canonical owner UUID; do not rewrite `washdesk_workspaces.owner_auth_user_id` or delete old Auth identities as a routine upgrade.
