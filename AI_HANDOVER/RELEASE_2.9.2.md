# Release 2.9.2 — Prime Auto Care / WashDesk

Release date: 18 November 2026  
Repository: https://github.com/zaid404sec/zaid404sec  
Merged PR: https://github.com/zaid404sec/zaid404sec/pull/56  
Main commit: `a8a4fb14f4219cd9fd9f8f1976ff8064c5ce134a`  
Main CI: [Build run #220 — success](https://github.com/zaid404sec/zaid404sec/actions/runs/44240836622)

## Product changes

- Adds the Number & notification group manager under Offers & WhatsApp.
- Named Indian mobile contacts can be created, edited and removed. Indian mobile number validation and duplicate prevention are included.
- Contacts can be assigned to Attendance, Expenses, Staff & payroll, Operations, Sales & bills, Inventory and Offers.
- "All contacts" includes every saved recipient.
- Date-scoped attendance and business-expense message templates are included. Personal/household expenses, staff advances and salary entries are excluded from the business-expense template.
- WhatsApp sharing remains manual and one-to-one. The owner reviews the message and chooses Send; there is no silent broadcast or automatic group addition.
- Recipient records are included in local save and WashDesk cloud sync.

## Database deployment

The additive migration `20261118050000_add_message_recipients_sync_merge` was applied to the existing Supabase project `jkjudmkqaebrgllemris`. It changes only the existing merge function to include the `messageRecipients` collection. The existing WashDesk workspace, member records and business snapshot remain intact.

## Build configuration

- App version: `2.9.2`
- Android application ID: `com.washdesk.carwash.v24`
- Service-worker cache: `prime-auto-care-shell-v29`
- Android build: successful in main run #220.
- Windows NSIS installer: successful in main run #220.
- Combined source/handover/full-release packaging: successful in main run #220.

## GitHub artifact IDs

| Artifact | ID |
|---|---:|
| WashDesk-Android-APK | 14399920220 |
| WashDesk-Windows-Installer | 14399551693 |
| WashDesk-Project-Source | 14399681390 |
| WashDesk-Complete-Project-Handover | 14398979658 |
| WashDesk-Full-Release-Package | 14399885975 |

Artifacts follow GitHub Actions retention and should be downloaded for long-term storage. The combined package includes an internal `SHA256SUMS.txt` file.

## Installation and continuity warning

This debug APK uses `com.washdesk.carwash.v24`, so it installs alongside v23 rather than updating it. Its local app storage is separate. Keep the existing v23 app installed, pair v24 with the same private Prime Auto Care workspace or restore a verified JSON backup, and confirm customers, vehicles, invoices, payments, staff, attendance, advances, expenses, inventory and settings before switching.

The Windows installer is an NSIS installer. Keep an independent JSON backup before changing versions.

## Remaining external activation

The Google Review AI database schema is deployed, but the four Google Review Edge Functions were not present in the Supabase project at final check, and no OAuth connection/review sync data had been created. Configure the secrets and deploy functions using `AI_HANDOVER/GOOGLE_REVIEW_DEPLOYMENT.md` after Google Business Profile API Basic Access is approved.

The latest GitHub Pages run #67 built and uploaded the website but its deploy job failed. The website was not yet verified public or added to the Google Business Profile. Do not report Google API access or live alerts as complete until approval, OAuth, sync and Pub/Sub push are tested.
