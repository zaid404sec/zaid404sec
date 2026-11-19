# Prime Auto Care — public one-page website

This mobile-first public website is stored at `car-wash-erp/website/` and is included in the repository's existing GitHub Pages deployment.

## Included
- Responsive black-and-gold Prime Auto Care identity.
- Services, business address and normal opening hours.
- Customer booking portal at `/website/booking/`, connected to the WashDesk booking API. Requests remain pending until Prime Auto Care confirms them.
- WhatsApp enquiry form for general questions, in addition to the appointment request flow.
- Google Business Profile link supplied by the owner.
- A Google Business Profile & Reviews call-to-action using the exact profile link supplied by the owner.
- LocalBusiness / AutoWash structured data.

## Expected public URL
`https://zaid404sec.github.io/zaid404sec/website/`

The repository already has `.github/workflows/pages.yml`, which builds and publishes the full `car-wash-erp/` folder. That workflow now also generates the app's PWA/Windows icon assets before running validation. This website is deployed as the `/website/` path within that existing Pages site; do not create a second, competing Pages deployment workflow.

## Publish and verify
1. Merge the website and app changes after the feature pull request passes checks.
2. In GitHub, open repository **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. GitHub requires this for a custom Actions publishing workflow. See the [GitHub Pages publishing-source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
3. Wait for the existing **Deploy WashDesk to GitHub Pages** workflow to complete successfully.
4. Open the expected public URL on a phone. Check that the images, telephone links, WhatsApp button and Google Profile button work.
5. Sign in to the Google account that owns Prime Auto Care. Open the Business Profile and choose **Edit profile → Contact → Website**. Add the live public URL and save it.
6. Confirm the website link appears on the public Business Profile in Google Search / Maps.


## Live Google reviews

The home page includes a recent-review section backed by the Supabase public-reviews Edge Function. It returns a small, privacy-limited set of genuine Google reviews only; it does not expose internal review IDs, tokens, database rows or customer contact details. The website displays a business reply only when Google's reviewReplyState is APPROVED. When no reviews have synced yet, the page shows a clear empty state and directs visitors to the public Google Business Profile instead of displaying fake testimonials.

The feed stays empty until Google Basic API Access is approved, the original Business Profile owner completes OAuth, and WashDesk syncs real review records. The website's customer booking page also supports an optional urgent-request flag; every request still waits for staff confirmation.

## Booking and advance-payment boundary

The booking portal collects the customer's name, phone number, vehicle registration and category, service, preferred date/time and optional notes. WashDesk validates the requested time against opening hours and configured bay capacity, then stores it as **Pending**. Staff must confirm the appointment in WashDesk before the customer travels to the station. Customers can submit a request without an account; the staff dashboard is limited to paired workspace users. No payment, deposit, refund or cancellation fee is processed. A payment provider and merchant account would be a separate future integration.

## Owner review before public use
The business phone number, secondary phone, address and regular hours use the details supplied for Prime Auto Care. Check them before publishing. The supplied `share.google` link opens the Business Profile. The separate direct review URL in WashDesk should be tested by the owner before it is placed on invoice PDFs; the printable counter QR currently opens the supplied Business Profile link.
