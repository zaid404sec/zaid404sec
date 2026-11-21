# Prime Auto Care 2.14.0 — Owner login and invoice corrections

## Owner login
1. Open Business Settings.
2. Choose the primary or second Owner email from Username.
3. Enter that account's current Supabase Auth password.
4. Tap **Connect & open Prime Auto Care**.

Both email accounts are already members with the Owner role. They access the same existing canonical cloud snapshot. No 64-character workspace pairing code or SQL setup is required on an Owner phone. The app still verifies the password with Supabase Auth; it does not bypass authentication or save passwords in the APK.

If Supabase returns **Invalid login credentials**, the password currently registered in Supabase Auth does not match the password entered. Do not reset the business database or delete an Auth user. Update the existing user's password through the secure Supabase Auth recovery/admin process. The normal Owner login layout no longer shows a Forgot/Reset button.

## Owner and staff permissions
Both registered Owner accounts retain full access to invoices, customers, services, expenses, staff, inventory, reports, settings and Bookings Accept / Reject. Additional Member/staff accounts retain Booking-only permissions. Do not share Owner passwords with staff or encode them in the app.

## Invoice date and payment corrections
- New bill form includes an editable invoice date; the invoice number is reserved for that date.
- Existing invoice date and payment mode can be edited from **Edit invoice**.
- The invoice shows its recorded payment rows. Each row can be edited for amount, date and Cash / UPI method, or deleted. Deleting a payment increases the invoice balance; its sync tombstone propagates the removal to the other Owner phone.
- A posted invoice is not physically deleted. **Delete / cancel** voids it, retains a CANCELLED audit record, excludes it from sales totals and reverses the invoice's stock movement. Handle any real customer refund separately.

## Shared two-phone cloud
Both Owner phones connect to the same Supabase workspace. Realtime updates render while the apps are active and online. A 30-second reconciliation and foreground refresh recover missed updates after sleep or connectivity loss. Test a small non-production edit in both directions and confirm it appears on the other phone before relying on background synchronization.
