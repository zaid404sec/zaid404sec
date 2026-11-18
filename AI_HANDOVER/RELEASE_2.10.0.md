# WashDesk 2.10.0 — Release and Operations Handover

_Date: 18 November 2026_

## Purpose

Version 2.10.0 extends the existing Prime Auto Care WashDesk ERP with a Google Review Center Growth Studio. It preserves the current customer, vehicle, invoice, payment, inventory, purchase, expense, staff, payroll, backup and shared-cloud workflows. It does not reset the Supabase project or replace the existing Workspace Owner.

## Release contents

- Warm neutral/gold liquid-glass treatment for the application workspace, cards, forms, buttons and Growth Studio. The original Prime Auto Care brand identity and invoice PDF templates remain intact.
- Manual Google review reply workspace. A user can paste a public review, write or generate a reply draft, copy it, open Google Business Profile Manager, and publish manually in Google.
- Free-model AI route using OpenRouter's free model selector. Paid model IDs are rejected by the server-side action.
- AI review-reply drafts with an instruction to stay factual, avoid keyword stuffing, flag complaints and never ask customers to change a rating.
- Surat/Gujarat keyword suggestions based on configured services and local business facts.
- Google Trends comparison links. AI relevance scores are editorial suggestions, not measured search volume, ranking or "most searched this month" statistics.
- Up to two shared Google post drafts per workspace per Asia/Kolkata date, generated on the first authorised Review Center open with an AI key saved. A server-only daily-run record prevents paired devices from generating duplicate daily batches.
- Real-photo upload for JPG/PNG (10 KB–5 MB and at least 250 × 250 px). The app can create a 1080 × 1350 gold/black poster using the uploaded real business photo.
- Existing Google Business Profile API publish path remains optional and requires Google Basic API Access and OAuth.
- Public website includes services, location, Google profile and WhatsApp details plus a WhatsApp enquiry form.

## Free AI setup

1. Open WashDesk v24 and go to **Google Reviews → AI Growth Studio**.
2. Open [OpenRouter Keys](https://openrouter.ai/keys) in the browser and create a free API key on your OpenRouter account.
3. Paste the key into **OpenRouter API key · this device only** and press **Save key**.
4. Press **Test free AI**. A successful test should show that the free AI connection is active.
5. Use **Generate reply draft** for a public review, **Generate local keywords** for local phrase ideas, and **Generate 2 additional drafts** if you need extra posts beyond the daily batch.
6. The daily draft run is attempted when an authorised device opens the Review Center with its key saved. The first paired device to trigger the run creates up to two posts for the shared workspace; other devices see those same saved posts.

The key is stored in this device's browser local storage. It is not synchronised to other phones, written to WashDesk backup data, or saved in the shared growth tables. Enter it separately on each authorised device that should be able to generate drafts. Do not paste it into GitHub, a ZIP, a screenshot, a public note or a chat message.

### Cost and quota boundary

The app sends AI requests only to the OpenRouter free-model route. OpenRouter's free model availability and limits are provider-controlled and can change. The published free route is limited (commonly 20 requests/minute and 50/day); a request can fail if the free route is unavailable or the quota is exhausted. This is a free route, not a guarantee of unlimited use or 24/7 service. No paid model ID is accepted by this app action.

The app does not operate a background AI worker while closed. The daily draft job is triggered by opening the Google Review Center from an authorised device with its local key saved. This avoids storing a private AI key as a server secret or copying it among all paired devices.

## Review reply workflow without Google API approval

1. Open [Google Business Profile Manager](https://business.google.com/).
2. Select PRIME AUTO CARE and open **Read reviews**.
3. Copy the customer's public review text into WashDesk's **Manual reply workspace**.
4. In AI Growth Studio choose **Generate reply draft**, or write your own reply manually.
5. Check all facts, tone and spelling, then choose **Copy reply**.
6. Return to Google, paste the reply beside the correct review and press **Reply**.

The business reply is published by Google, not by WashDesk. WashDesk does not report it as published. Do not include private contact details or registration numbers in an AI prompt; automatic masking is best-effort, not a guarantee.

## Daily post and branded photo workflow

1. Open the Review Center with a free AI key saved. The daily run checks the shared library and creates missing drafts up to a maximum of two per workspace/day.
2. Read each draft and verify every service, price, opening hour, offer and claim. The AI is instructed not to invent discounts, completed jobs, customer stories or service results.
3. Upload a genuine business JPG/PNG photo. The image must be 10 KB–5 MB and at least 250 × 250 px.
4. Choose **Create gold-glass poster** to make a branded poster from that photo. The poster overlays text and branding; it does not create a fake vehicle, customer or wash result.
5. Save the draft, copy its Google post text, and publish it manually in Google Business Profile until the Google API is approved.
6. Do not add unrelated or repeated keywords. Use the main phrase naturally and check suggested phrases in Google Trends.

## Keyword research limits

The planner suggests phrases such as car wash, car cleaning, foam wash, four-wheeler wash, SUV wash, taxi wash, bike wash and detailing only when those services are configured in WashDesk. The score is an AI relevance assessment, not actual demand. Google Trends comparisons show relative interest for selected terms and regions; the current Google Trends API is alpha/limited access. The app must not display invented search counts, trend percentages or a claim that a phrase is currently the most searched.

## Google Business Profile automation boundary

The following still requires Google-side approval/configuration:
- Google Business Profile Basic API Access approval for the Cloud project.
- OAuth client configuration and Primary Owner authorisation.
- Matching the Google API Location resource and testing the profile ID.
- Pub/Sub topic, subscription and notification registration for near-real-time review events.

Until those prerequisites are verified, API review sync, automatic API replies, direct Google post/photo publishing and Pub/Sub alerts are not active. The Review Center remains usable for manual reply preparation, AI drafts, keyword suggestions, post drafts and manual publishing.

## Public website

Expected URL after successful GitHub Pages deployment:

https://zaid404sec.github.io/zaid404sec/website/

The site includes local business content/structured data and a WhatsApp enquiry form. The form opens a pre-filled WhatsApp message; the user must press Send. It is an enquiry, not a confirmed booking, and does not collect an advance payment.

**Deployment requirement:** In GitHub repository Settings → Pages → Build and deployment → Source, choose **GitHub Actions** and save. Then confirm the Pages deployment workflow completes successfully and open the website URL on a phone. Only after that should the URL be added to the PRIME AUTO CARE Google Business Profile under Edit profile → Contact → Website. Website metadata and structured data do not guarantee indexing or a particular Google Maps/search ranking.

## Booking and advance payments — future phase

Appointment booking and advance collection are not included in this release. The current public website form is only a WhatsApp enquiry. A true booking system needs:
- Slot capacity and overlap rules (wash bays/staff/vehicle size/service duration).
- Create, confirm, reschedule, cancel and no-show rules.
- Deposit amount/percentage, balance collection, refund/cancellation policy and receipt.
- Payment provider / merchant onboarding and protected server-side credentials.
- Webhook verification, idempotent payment state changes, invoice/customer linking and shared-cloud sync.

Do not collect or claim an advance until a payment gateway/merchant account has been selected and tested. UPI intent or QR is a separate approach from a verified online payment gateway.

## Data safety and installation

- Preserve the original Workspace Owner. v24 remains a member with a separate Google Reviews-only permission; do not promote it to general owner.
- Existing ERP business data and sync tables are not reset by this release.
- The Android application ID is com.washdesk.carwash.v24. GitHub Actions produces a debug-signed APK with a runner-generated signing key. An identical package ID does not guarantee that an APK can update an installed copy if its signing certificate differs.
- Do not uninstall v23/v24, clear app storage or restore a backup to another paired device as an installation workaround. Keep a verified backup and stop if Android reports a signature conflict. Test pairing/data continuity before switching day-to-day operations.
- A successful CI run proves automated build and validation, not manual phone acceptance. Test app navigation, cloud sync, backups, invoice PDFs, notifications and WhatsApp handoff on the real devices before production use.

## Source and database files

- App UI and Growth Studio: car-wash-erp/index.html
- Google Reviews client wrapper: car-wash-erp/src/google-reviews.js
- Google Review API: car-wash-erp/supabase/functions/google-review-api/index.ts
- Existing Growth Studio schema/storage: car-wash-erp/supabase/migrations/20261118110000_google_ai_growth_studio.sql
- Daily idempotency table: car-wash-erp/supabase/migrations/20261118143000_google_growth_daily_runs.sql
- Website: car-wash-erp/website/index.html
- Validation: car-wash-erp/scripts/validate-app.mjs
- Offline cache: car-wash-erp/sw.js

All migrations are additive. Do not run the one-time cloud setup SQL as an update shortcut. Do not drop, truncate, reset or reseed the production workspace.
