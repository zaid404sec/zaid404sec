# WashDesk 2.9.4 — Manual Google Review Replies & Mobile Navigation

Release intent
- Keep Google Business Profile API/OAuth optional. Manual review replies must remain usable while API access is pending.
- Fix the mobile navigation drawer so it has its own scroll area, blocks background scrolling, closes on destination selection, and closes from the backdrop or Escape.
- Keep the original Prime Auto Care Workspace Owner unchanged.

Google Reviews workflow
1. Open Google Review Center in WashDesk.
2. Select **Manage reviews on Google**. This opens the Google Business Profile manager.
3. Sign in with the Google account that manages PRIME AUTO CARE.
4. Select PRIME AUTO CARE, open **Read reviews**, and choose **Reply** beside the relevant review.
5. In WashDesk, write the reply in the Manual reply workspace and select **Copy reply**.
6. Paste it into Google's reply box and press **Reply** in Google.

Important limitation
- WashDesk can prepare and copy a reply without OAuth or Gemini.
- Publishing still occurs in Google Business Profile itself in manual mode. WashDesk must not display a success state or mark a Google reply as published unless Google confirms it.
- Direct in-app publishing, automated review import, and live Pub/Sub notifications still require Google Business Profile API access and OAuth credentials.
- Google may review submitted replies before they appear publicly.

Growth workflow
- Continue neutral review invitations for genuine customers.
- Keep business hours, services, contact information and website accurate.
- Add recent authentic wash photos and timely business updates in Google Business Profile.
- Respond professionally to positive and negative feedback without incentives or review filtering.

Mobile navigation
- Mobile drawer scrolls independently with touch momentum.
- Background page scrolling is locked while the drawer is open.
- Tapping a navigation destination closes the drawer.
- Tapping the backdrop or pressing Escape closes the drawer.
- Desktop sidebar remains in its existing layout.

Data and permissions
- No invoice, customer, inventory, expense, staff or cloud-sync schema is changed by this UI release.
- The scoped v24 Google Reviews permission remains separate from the original Workspace Owner and from all other WashDesk modules.
- No OAuth credential, service-role key, Gemini key or device pairing code belongs in the source package.

Build
- Application version: 2.9.4
- Android package: com.washdesk.carwash.v24
- Android versionName/versionCode are set from package.json by the build workflow.
- Release artifacts must only be called complete after Android, Windows, backend checks and source packaging all succeed.
