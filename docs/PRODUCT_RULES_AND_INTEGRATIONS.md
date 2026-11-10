# Artist Frequency — Product Rules and Integrations

## Confirmed product rules

- Free individual artist accounts.
- Each non-admin artist receives 40 free credits on registration.
- Credits reset to exactly 40 every Monday at 00:05, Africa/Johannesburg time. Months contain four or five Monday resets. Unused credits do not roll over.
- A playlist submission costs 1 credit only when its destination has a deployed delivery integration and is verified, public, active and explicitly accepting submissions.
- A radio-station submission follows the same one-credit eligibility rule.
- A website-promotion submission follows the same rule; a website listing alone is not sufficient.
- Admin account: `kingpinpkaytee@gmail.com`. The verified admin has unlimited submissions.
- Artists provide a Spotify Artist URL and supplementary profile details.
- Verification requires an authorised admin or trusted integration to confirm the artist follows the official Artist Frequency Spotify playlist. A checkbox alone never awards a badge.
- Public statistics are real database counts of public artist profiles and verified, active directory entries.
- Marketplace tracks require admin approval and publish 24 hours later.
- Automatic Marketplace promotion means internal placement on the Artist Frequency website only.
- Weekly Marketplace Top 5 is an admin-curated editorial selection, not a fabricated popularity ranking.
- Campaign briefs are requests for review; they do not guarantee placements.

## Artist accounts and identity

Supabase Auth provides email/password registration and sign-in. The browser contains a Google OAuth flow, but the Google provider and exact redirect allowlist must be enabled in Supabase before Google sign-in is available.

A database trigger creates each artist profile. The admin role is assigned only when Supabase confirms the configured admin email. Never trust user-editable metadata to grant admin privileges.

Profile fields include artist/display name, country, biography, genres, Spotify Artist URL, website, social links and an optional press-kit URL. Migration 0014 adds the structured genre array and press-kit URL. Public profile information must be separated from private account/contact information.

## Spotify popularity

Show a Spotify popularity value only when an authorised Spotify API integration returns the dedicated popularity field for the artist. Do not scrape Spotify pages, infer a score from follower counts, substitute a platform engagement score, or invent a missing value. Show "Not available" until an approved sync succeeds.

A separate Artist Frequency engagement score may be introduced later, but it must be labelled as the platform's own metric and its calculation disclosed.

## Credit and submission workflow

The signed credit ledger is the source of truth. Clients cannot directly write ledger records or create credit-charged opportunity submissions by inserting rows.

The protected `submit_artist_opportunity` RPC:
1. Requires a signed-in artist.
2. Validates the required text fields, URL scheme, submission type and target.
3. Confirms the destination is verified, public, active, integrated and explicitly accepting submissions.
4. Locks the artist profile to serialize concurrent submissions and weekly resets.
5. Checks the current ledger balance for non-admin users.
6. Creates a pending submission and records the one-credit debit atomically.

The destination check happens before the credit debit. When the destination is not eligible, the RPC rejects the request and no credit is charged. Admin accounts bypass the balance check and debit but do not bypass destination validation.

Migration 0015 adds `is_integrated` and `accepts_submissions` flags to directory records. Both default to false. The website's admin directory form cannot switch these flags on; they remain locked until a real delivery adapter is deployed and enabled by a trusted backend operation. Currently, no directory destination is eligible for in-platform credit-charged dispatch. An artist may still open a verified directory's official external link; doing so is not an Artist Frequency submission and does not consume credits.

The scheduled reset uses the same profile-row lock as the submission RPC, then reconciles the ledger to exactly 40 credits. A reset-run marker makes the operation idempotent for each artist and South African calendar week. The reset is scheduled at Sunday 22:05 UTC, equivalent to Monday 00:05 SAST. Never invoke the reset manually against real production balances as a test.

## Directories and matching

Directory categories include platforms, curators, playlists, radio stations, websites and bloggers. Public clients see only records marked public, active and verified. Recommendations should prioritise an artist's home country, then broaden by compatible genres and territories.

The protected admin workspace can create and update directory entries, record a public verification-evidence URL, publish/unpublish entries and deactivate them. The RPC is restricted to authenticated sessions and performs a database-side admin-role check. Direct browser table writes remain unavailable.

Directory visibility is separate from the ability to submit. A verified public entry may be browsed and its official link opened, while the in-platform submission selector remains empty until the delivery integration and acceptance flags are enabled by trusted backend operations. Do not publish fabricated contacts, approvals, or opportunities.

## Marketplace lifecycle

1. An authenticated artist shares a public DSP link and optional artwork/description.
2. The track is stored as pending and remains private.
3. An authorised admin reviews it through the protected moderation RPC.
4. Approval schedules publication 24 hours later.
5. A scheduled backend job publishes due tracks and records an internal promotion event.
6. An authorised editor selects up to five eligible published tracks for the weekly feature.

External ads, social posts, third-party playlist additions and external DSP promotion require separate integrations, artist consent and policy review.

## Campaign builder

Artists may describe their goals, preferred channels, target countries, genres, timing and campaign brief. Campaign creation does not guarantee placement or results. Staff must confirm actual integrated opportunities before any campaign is represented as active.

## Production deployment status — 9 November 2026

The Supabase production project is linked and migrations 0001–0015 are applied. The database has 11 public tables with RLS enabled and 21 RLS policies. Table/view grants use least privilege; default privileges for future public objects are hardened; privileged and trigger-only functions have explicit execution grants.

Migration 0014 adds structured artist genres and a press-kit URL. Migration 0015 adds integration/acceptance gates, a protected directory upsert RPC, an administrator read policy, and a replacement submission RPC that blocks credit spend for destinations without a working integration.

The production checks confirmed that:
- all 11 public tables still have RLS enabled;
- the policy count is 21;
- the new directory fields and admin RPC are present;
- anonymous execution of the admin directory RPC is denied;
- authenticated execution of the admin RPC is allowed;
- anonymous execution of the credit submission RPC is denied; and
- authenticated execution of the credit submission RPC is allowed, with an admin and eligibility check inside the function.

The weekly credit reset and five-minute Marketplace publisher cron jobs are active. Marketplace publishing has successful recorded runs. The weekly reset is registered for Monday 00:05 SAST; its first scheduled execution after deployment must be confirmed from cron history.

The browser frontend connects to the deployed backend for email/password authentication, artist profile read/update, public statistics, verified directory discovery, credit balance, protected submissions, campaign create/read, Marketplace share/publication, admin Marketplace moderation and admin directory management. The old localStorage write handlers have been removed. JavaScript ES-module syntax and static DOM-binding checks passed. Hosted-site browser testing with anonymous, artist and admin sessions is still required before public launch; the repository is not itself a hosting deployment.

## Remaining integration gates

- Confirm email confirmation/password recovery configuration and Google OAuth provider settings.
- Complete hosted browser validation with separate anonymous, artist and admin sessions.
- Deploy and verify real delivery adapters before enabling any directory's integration/acceptance flags.
- Build protected admin tools for campaign review and weekly Top 5 selection.
- Configure the official Spotify playlist URL/ID and trusted follow-verification process before enabling badges.
- Integrate Spotify API access only when approved and available.
- Add rate limits, abuse controls, account deletion, retention procedures and audit review.
- Publish privacy, Terms, content-rights and moderation policies before public launch.


## Expanded submission destinations — migration 0016

Migration 0016 extends directory and artist submission types to include playlist curators, promotion platforms and industry contacts alongside playlists, radio stations and websites. The administrator directory manager can maintain contact records, including a verified public contact email or official submission URL. The artist submission selector maps each new destination type to its matching directory category.

These are submission channels in the portal, not a claim that messages have already been delivered externally. The protected submission RPC still requires a destination to be verified, public, active, integrated and explicitly accepting submissions before it creates a credit-charged submission. Migration 0016 leaves all integration and acceptance flags false. A real delivery adapter (for example, a contracted email/API integration or an authorised recipient-side submission endpoint) must be deployed and tested before any destination can be enabled. Until then, artists can inspect official contact details and external submission links; no credit is charged for opening them.


## Google Search discovery, candidate review and expanded channels

The Google Programmable Search Element embedded on the public site is a user-facing search interface. The server-side discovery worker calls the Custom Search JSON API only for Google Cloud projects with existing API entitlement. Google closed that API to new customers on 20 January 2026 and announced retirement on 1 January 2027. The presence of a Search Engine ID and API key does not establish API entitlement. If Google returns 403 access denied, do not scrape Google result pages or report the worker as operational; evaluate a Google-supported replacement for the intended scope.

Discovery results are candidates, not verified directory entries. The worker writes pending review records and never automatically publishes or marks them verified. Administrators must check the destination's current official route, terms, fee status, genre fit and recipient before promotion into the public directory.

Migration 0023 expands the category model and protected submission RPC to support curators, platforms and industry contacts. Migration 0024 stages a Google Search batch of source-backed candidate pages, including South African radio submission routes, international radio contacts and free playlist submission platforms. These records remain private and pending review. No delivery is claimed by adding a contact email or external form URL.

A credit-charged portal submission may be enabled only after the corresponding delivery adapter is deployed, tested, authorised for the destination and the destination explicitly accepts submissions. Email delivery must respect recipient requirements, attachment limits, artist rights declarations and anti-spam rules. For destinations that require an MP3/WAV upload rather than a public streaming URL, the current track-link-only submission form is insufficient; do not dispatch until the required asset workflow exists.
