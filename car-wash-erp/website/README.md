# Prime Auto Care — public one-page website

This mobile-first public website is stored at `car-wash-erp/website/` and is served from the Supabase Edge Function `prime-auto-care-site`; the GitHub Pages workflow remains a source-preview fallback.

## Included
- Responsive black-and-gold Prime Auto Care identity.
- Services, business address and normal opening hours.
- Customer booking portal at `/website/booking/`, connected to the WashDesk booking API. Requests remain pending until Prime Auto Care confirms them.
- WhatsApp enquiry form for general questions, in addition to the appointment request flow.
- Google Business Profile link supplied by the owner.
- A Google Business Profile & Reviews call-to-action using the exact profile link supplied by the owner.
- LocalBusiness / AutoWash structured data.

## Expected public URL
`https://jkjudmkqaebrgllemris.supabase.co/functions/v1/prime-auto-care-site/`

The repository retains `.github/workflows/pages.yml` as a secondary preview workflow; the customer-facing links use the independent Supabase-hosted site. That workflow now also generates the app's PWA/Windows icon assets before running validation. This website is deployed as the `/website/` path within that existing Pages site; do not create a second, competing Pages deployment workflow.

## Publish and verify
1. Deploy the `prime-auto-care-site` Edge Function from the repository source.
2. Open the expected public URL on a phone. Check the booking form, images, telephone links, WhatsApp button, Google Profile button and real review feed.
3. Sign in to the Google account that owns Prime Auto Care. Open the Business Profile and choose **Edit profile → Contact → Website**. Add the live public URL and save it.
4. Confirm the website link appears on the public Business Profile in Google Search / Maps.


## Live Google reviews

The home page includes a recent-review section backed by the Supabase public-reviews Edge Function. It returns a small, privacy-limited set of genuine Google reviews only; it does not expose internal review IDs, tokens, database rows or customer contact details. The website displays a business reply only when Google's reviewReplyState is APPROVED. When no reviews have synced yet, the page shows a clear empty state and directs visitors to the public Google Business Profile instead of displaying fake testimonials.

The feed stays empty until Google Basic API Access is approved, the original Business Profile owner completes OAuth, and WashDesk syncs real review records. The website's customer booking page also supports an optional urgent-request flag; every request still waits for staff confirmation.

## Booking and advance-payment boundary

The booking portal collects the customer's name, phone number, vehicle registration and category, service, preferred date/time and optional notes. WashDesk validates the requested time against opening hours and configured bay capacity, then stores it as **Pending**. Staff must confirm the appointment in WashDesk before the customer travels to the station. Customers can submit a request without an account; the staff dashboard is limited to paired workspace users. No payment, deposit, refund or cancellation fee is processed. A payment provider and merchant account would be a separate future integration.

## Owner review before public use
The business phone number, secondary phone, address and regular hours use the details supplied for Prime Auto Care. Check them before publishing. The supplied `share.google` link opens the Business Profile. The separate direct review URL in WashDesk should be tested by the owner before it is placed on invoice PDFs; the printable counter QR currently opens the supplied Business Profile link.
