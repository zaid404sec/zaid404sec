# Google Review Management + three-level GenAI rollout

## Owner configuration received
- Google account: owner-supplied; confirmed during OAuth authorization and not hard-coded in the public repository.
- Business Profile role: Primary owner
- Business Profile ID supplied by owner: `13506481990772076097`
- Profile URL: `https://share.google/6g3f0aJqTezi6JH5T`
- WhatsApp invitation number: `7777970261`
- Website: being prepared in `/website`; owner must publish it and add the live URL to the Google Business Profile.

## Current staged work in this branch
- A responsive, black-and-gold one-page website in `website/index.html`.
- A GitHub Pages deployment workflow in `.github/workflows/deploy-prime-auto-care-site.yml`.
- A new **Google Review Center** navigation page in WashDesk.
- The supplied Google Business Profile ID and URL are prefilled in Business Settings.
- The page clearly shows API access as pending; it does not invent reviews, ratings or connection state.

This is a staged implementation, not a completed live Google integration. The app still needs the server-side OAuth and sync functions, AI provider credentials, a deployed Supabase migration, and end-to-end testing before a production APK can be declared complete.

## Three-level GenAI model

The term “GenAI” is treated as a provider-neutral generative-AI layer. A Gemini-compatible provider can be configured server-side after the owner chooses and supplies the relevant API access. The three tiers intentionally progress from a grounded chatbot, to a single task agent, to an orchestrated multi-agent business copilot. This reflects a common maturity path for GenAI systems; the app keeps the owner in control of consequential actions. See the [Microsoft explanation of chatbots, single agents and multi-agent systems](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/business-in-a-box-applying-autogen-and-multi-agent-systems-to-an-enterprise-cont/4150736/replies/4199285).

### Level 1 — Grounded Review Chatbot
- Ask natural-language questions about the synced Google review dataset.
- Summarise review activity by period, star rating and topics.
- Retrieve relevant review evidence to support each answer.
- Explain limits when there is insufficient data.
- Read-only: it cannot post replies or change business records.

### Level 2 — Single Review Management Agent
- Classify sentiment and recurring service / experience topics.
- Detect and prioritise complaints or time-sensitive concerns.
- Generate context-aware owner reply drafts grounded in the original review.
- Propose follow-up tasks for staff or owner review.
- Write actions only through validated server tools and permission checks; publishing a Google reply requires explicit owner approval.

### Level 3 — Multi-Agent Business Growth Copilot
- Review Analyst Agent: detects trends, repeated topics and rating movement.
- Customer Experience Agent: identifies recurring complaints, positive themes and operational risk.
- Improvement Planner Agent: recommends service/process improvements grounded in the review evidence.
- Management Reporter Agent: creates weekly/monthly summaries and answers broader business questions using the approved review dataset.
- A coordinator combines their outputs, shows evidence and confidence/limitations, and returns suggestions for owner decision. No independent refunds, customer contact, review publication or accounting changes.

The three levels share the operational foundation: invoice PDF invitation, one-tap WhatsApp invitation, counter QR, review inbox, rating distribution, unanswered count, duplicate protection, Pub/Sub notifications and scheduled catch-up sync.

**Safety / platform guardrails:** no incentives, no selective positive-review solicitation, no review gating, no pressure at the premises, and no staff review quotas. AI must not invent business facts, promise refunds or compensation, create reviews for customers, or publish a response without explicit owner approval. Invitations and received reviews are reported separately; WashDesk must not attribute an individual Google review to a particular invoice.

## Google access path
Google's current official prerequisites include:
1. A Google account.
2. A Google Business Profile verified and active for 60+ days.
3. A website representing the business and listed on that profile.
4. A Google Cloud project and a submitted **Application for Basic API Access**.
5. Approval before the Business Profile APIs can be enabled and used.
6. OAuth 2.0 authorization using `https://www.googleapis.com/auth/business.manage`.

The owner account must complete the Google OAuth consent step. The Google API approval outcome is controlled by Google.

## Server-side components still required
- Google OAuth callback and secure refresh-token storage.
- Google Business Profile account/location resolution and Reviews API sync.
- Pub/Sub topic and verified notification receiver.
- Scheduled reconciliation so missed push messages do not leave the inbox stale.
- Server-side AI provider adapter for Level 2 and Level 3.
- Server-side reply publication endpoint that checks explicit owner approval.
- Supabase Edge Function secrets for OAuth client credentials, Google tokens, Pub/Sub verification and AI provider keys.

Never place OAuth tokens, service-role keys, AI API keys or Google client secrets in `index.html`, Android assets, the APK, the Windows installer or public Git history.

## Database migration
`supabase/migrations/20261117000100_google_reviews.sql` creates additive tables for review settings, synced reviews, invitation logs, AI analysis, reply drafts and sync logs. It uses workspace-scoped RLS and keeps OAuth/AI secrets out of client-readable tables.

Do not execute it against the live Supabase project until the branch has passed review and the owner is ready to add the new schema. The migration is additive; it does not drop or rewrite business tables.

## Website publishing and Google Business Profile
1. Merge the website branch after review.
2. In GitHub repository settings, set **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Wait for the Pages workflow to deploy successfully.
4. Test `https://zaid404sec.github.io/zaid404sec/` on a phone.
5. In the Google Business Profile, choose **Edit profile → Contact → Website**, add the live URL and save.
6. Confirm the public Profile actually displays the website link before applying for API access.

## Still not completed
- GitHub Pages repository setting must be enabled by an account admin.
- The public site has not yet been deployed or verified.
- The website URL has not yet been added to Google Business Profile.
- Google Basic API Access has not been requested or approved.
- OAuth, Pub/Sub, Edge Functions and AI provider secrets have not been configured.
- Physical Android and Windows testing has not been performed for this staged module.
- No production APK has been built from this branch.
