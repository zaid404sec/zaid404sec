# Google Reviews + AI setup guide — Prime Auto Care

This guide is written for the original Workspace Owner. The app now has a guided Vault-backed setup flow, but Google still requires the Business Profile owner to approve OAuth and the Google Cloud project to receive API access.

## Before starting
- Use the Google account that is an Owner or Manager of the verified Prime Auto Care Business Profile.
- The public website is: https://jkjudmkqaebrgllemris.supabase.co/functions/v1/prime-auto-care-site/
- The Google Business Profile's Website field must point to that same public website.
- Google Basic API Access approval is a Google decision. A WashDesk pairing code cannot bypass it.
- A Google Cloud project number is not an API key. The OpenRouter AI key is not a Google OAuth credential.

## 1. Update the Business Profile website
1. Sign in to the Google account that owns/manages Prime Auto Care.
2. Open the Business Profile in Google Search or Business Profile Manager.
3. Choose Edit profile → Contact → Website.
4. Set the Website field to:
   `https://jkjudmkqaebrgllemris.supabase.co/functions/v1/prime-auto-care-site/`
5. Save and confirm the link opens.

## 2. Request Google Business Profile API access
1. Open the official Google Business Profile API prerequisites and Basic API Access documentation:
   - https://developers.google.com/my-business/content/prereqs
   - https://developers.google.com/my-business/content/basic-setup
2. In Google Cloud Console, select the project intended for Prime Auto Care.
3. Open Project Dashboard and copy the numeric **Project number** (not the project ID).
4. Submit the Basic API Access request using the same Google account that manages the verified Business Profile.
5. Confirm the profile is verified, has been active for at least 60 days, and has the public website listed.
6. Wait for Google's approval. In API quotas, 0 requests per minute means access is not approved; the standard approved quota is shown in the Google documentation.
7. Enable the Business Profile APIs required by the Reviews and Notifications features in the selected project.

## 3. Create the OAuth Web Client
1. In Google Cloud Console, open Google Auth Platform / APIs & Services → Credentials.
2. Configure the OAuth consent screen for the owner account and add the owner as a test user if the app is still in Testing.
3. Create an OAuth Client ID with application type **Web application**.
4. In WashDesk → Google Review Center → Setup, copy the exact OAuth redirect/callback URL shown by the app.
5. Add that exact URL under **Authorised redirect URIs** in the Google OAuth Web Client.
6. Save and copy the Web Client ID and Client Secret.

## 4. Save Google credentials in WashDesk
1. Open the latest WashDesk app and sign in as the original Workspace Owner.
2. Open Google Review Center → Setup.
3. Enter the numeric Google Cloud Project number, OAuth Web Client ID and OAuth Client Secret.
4. Enter the token-encryption key requested by the setup page. Generate a fresh random 32-byte key; do not reuse an API key.
5. Save the setup. The credentials are written server-side to Supabase Vault; they are not stored in the APK or browser source.
6. Select **Connect Google** and complete Google's consent screen using the original Business Profile Owner account.

Google's OAuth consent is still required. A pairing code only authorises a WashDesk phone/workspace action; it does not sign in to Google.

## 5. Configure Pub/Sub review notifications
1. In the same Google Cloud project, enable the Pub/Sub API.
2. Create a Pub/Sub topic for Business Profile review notifications.
3. Grant the Google Business Profile notification publisher service account `mybusiness-api-pubsub@system.gserviceaccount.com` permission to publish to that topic.
4. Create a push subscription to:
   `https://jkjudmkqaebrgllemris.supabase.co/functions/v1/google-review-pubsub-webhook`
5. Configure authenticated push delivery with an OIDC service account and the exact audience required by the WashDesk Setup screen.
6. Enter the topic name, push service-account email and audience in WashDesk → Google Review Center → Pub/Sub Setup, then save.
7. Use the app's Test/Verify action and confirm the worker receives an authenticated notification.

Official notification documentation:
- https://developers.google.com/my-business/content/notifications
- https://cloud.google.com/pubsub/docs/push

## 6. Configure the AI provider safely
1. The OpenRouter key previously pasted in chat is compromised. Revoke it in OpenRouter.
2. Create a replacement key.
3. Enter the replacement in WashDesk → Google Review Center → AI Provider Setup.
4. Save it through the owner-only setup flow. It is stored in Supabase Vault and read by the server-side worker.
5. Do not paste API keys, OAuth client secrets, token-encryption keys or service-account private keys into chat, source files, APKs or screenshots.

## 7. Verify before enabling replies
- Confirm the original Owner OAuth connection is active.
- Confirm review sync returns actual reviews.
- Confirm Pub/Sub test messages arrive and are authenticated.
- Confirm the AI draft is generated and stored.
- Confirm Google's moderation/publication status is re-read after a reply submission.
- Keep automatic replies disabled until the above checks pass and the Owner explicitly enables them.

## Current verified status
At the last production check, the app setup wizard was deployed but no OAuth app config, Owner OAuth connection, OpenRouter Vault key or Pub/Sub worker secret had been saved. The live review cache contained 0 reviews. Therefore the public website and booking portal are deployed, but live Google review content and AI replies cannot become active until the external Google and owner setup steps above are completed.
