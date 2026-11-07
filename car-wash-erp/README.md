# WashDesk — Car Wash Business Manager

A mobile-friendly, installable starter app tailored to a car washing centre.

## Included
- Customer and vehicle register: contact details, vehicle class, registration number and visit history.
- Service catalogue with standard, private-car, taxi, commercial-vehicle and SUV rates.
- Invoice builder with multiple line items, line and invoice discounts, configured GST rates, financial-year invoice numbering, partial payments and balances.
- Invoice preview, locally generated styled PDF export, native Android save to Downloads, and PDF sharing through the Android share sheet (including WhatsApp).
- Inventory register, low-stock alerts, purchase entries, weighted-average purchase cost and stock adjustments.
- Optional one-consumable-per-service recipe for automatic stock deduction when a service is invoiced.
- Expense register, staff directory, invoice staff assignment and monthly management summaries.
- JSON backup/restore and invoice CSV export.
- Service-worker caching for the app shell and install-to-home-screen support.

## Version 1.1.0 migration and updates

- **Windows:** Install the new EXE over the existing WashDesk installation in the same folder. Electron stores browser data separately from the installer files; keep a JSON backup before updating.
- **Android:** This build uses a new application ID because the old debug-signing private key is not available in the build environment. It installs beside the previous app so the old records remain untouched. Export a backup from the old app, install **WashDesk Updated**, then use Business Settings → Restore backup once. Do not uninstall the old app until the restored records are checked.
- **Cloud sync:** A Supabase project, the included SQL setup, and the same sign-in on every device are required before realtime multi-device sync becomes active. Offline changes stay local and are uploaded when the device reconnects.

## Important limitations — read before using live business data
This is a first working frontend edition. Business data is stored in the current browser's local storage. It does not yet provide cloud sync, multi-user accounts, role permissions, automatic server backup, a secured backend database, complete double-entry accounting, bank reconciliation, statutory audited Profit & Loss / Balance Sheet, GST return filing, IRN e-invoice generation, e-way bills, payroll compliance, supplier ledgers or AMC/prepaid wash-pass redemption. Use Export Backup regularly. Do not use a shared/public device for live customer data.

WhatsApp sharing is user-initiated. The app cannot silently send a message through a personal WhatsApp account. Fully automated outbound delivery needs the official WhatsApp Business Platform, Meta business setup, approved templates where applicable, and securely stored server-side credentials.

GST registration, SAC/HSN codes, tax rates, place of supply, reverse-charge treatment and invoice particulars must be confirmed by the business's chartered accountant. This starter app is not a tax/accounting certification and does not replace TallyPrime.

## Run locally
Serve this folder over localhost or HTTPS (service workers do not run from a plain file URL):

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages
The repository workflow at `.github/workflows/pages.yml` deploys the contents of this folder. In GitHub, open **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**, then check the Actions tab for the deployment result. When the workflow succeeds, the site will be available at the Pages URL shown in the deployment output.

Open the published HTTPS site on your Android phone and choose **Install app** or **Add to Home screen** in the browser. Each browser/device has its own local records; export and restore a backup when moving devices.
