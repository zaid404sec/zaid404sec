# Prime Auto Care — public one-page website

This mobile-first public website is stored at `car-wash-erp/website/` and is included in the repository's existing GitHub Pages deployment.

## Included
- Responsive black-and-gold Prime Auto Care identity.
- Services, business address and normal opening hours.
- WhatsApp enquiry buttons for +91 77779 70261.
- Google Business Profile link supplied by the owner.
- A Google review call-to-action using the review URL already configured in WashDesk. Verify this direct review URL from the owner's Business Profile before using it on printed QR materials.
- LocalBusiness / AutoWash structured data.

## Expected public URL
`https://zaid404sec.github.io/zaid404sec/website/`

The repository already has `.github/workflows/pages.yml`, which builds and publishes the full `car-wash-erp/` folder. This website is deployed as the `/website/` path within that existing Pages site; do not create a second, competing Pages deployment workflow.

## Publish and verify
1. Merge the website and app changes after the feature pull request passes checks.
2. In GitHub, open repository **Settings → Pages** and confirm the source is **GitHub Actions**. The existing WashDesk Pages workflow should already use this source.
3. Wait for the existing **Deploy WashDesk to GitHub Pages** workflow to complete successfully.
4. Open the expected public URL on a phone. Check that the images, telephone links, WhatsApp button and Google Profile button work.
5. Sign in to the Google account that owns Prime Auto Care. Open the Business Profile and choose **Edit profile → Contact → Website**. Add the live public URL and save it.
6. Confirm the website link appears on the public Business Profile in Google Search / Maps.

## Owner review before public use
The business phone number, secondary phone, address and regular hours use the details supplied for Prime Auto Care. Check them before publishing. The supplied `share.google` link opens the Business Profile. The separate direct review URL is the current WashDesk default (`https://g.page/r/CYMPgw3oQ1hfEBM/review`) and may be replaced in Business Settings. Confirm it opens the correct Prime Auto Care review form before generating physical QR material.
