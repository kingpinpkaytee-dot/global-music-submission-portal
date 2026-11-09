# Artist Frequency — Product Rules and Integrations

## Confirmed product rules

- Free individual artist accounts.
- Each non-admin artist receives 40 free credits on registration.
- Credits reset to exactly 40 every Monday at 00:05, Africa/Johannesburg time. There are four or five reset Mondays in each calendar month. Unused credits do not roll over.
- A playlist submission costs 1 credit.
- A radio-station submission costs 1 credit.
- A website-promotion submission costs 1 credit only when the destination is verified, active, integrated and accepting submissions.
- Admin account: `kingpinpkaytee@gmail.com`. The verified admin has unlimited submissions.
- Artists provide a Spotify Artist URL and supplementary profile details.
- Verification requires an authorised admin or trusted integration to confirm the artist follows the official Artist Frequency Spotify playlist. A checkbox alone never awards a badge.
- Public statistics are real database counts of public artists and verified, active directory entries.
- Marketplace tracks require admin approval and publish 24 hours later.
- Automatic Marketplace promotion means internal placement on the Artist Frequency website only.
- Weekly Marketplace Top 5 is an admin-curated editorial selection, not a fabricated popularity ranking.
- Artists may create campaign briefs describing desired promotion. A brief is a request, not a guarantee of placements.

## Artist accounts and identity

Supabase Auth provides email/password registration and sign-in. The browser contains a Google OAuth flow, but the Google provider and exact redirect allowlist must be enabled in Supabase before Google sign-in is offered as an active method.

A database trigger creates each artist profile. The admin role is assigned only when Supabase confirms the configured admin email. Never trust user-editable metadata to grant admin privileges.

Profile fields include artist/display name, country, biography, genres, Spotify Artist URL, website, social links and an optional press-kit URL. Migration 0014 adds the structured genre array and press-kit URL. Public profile information must be clearly separated from private account/contact information.

## Spotify popularity

Show a Spotify popularity value only when an authorised Spotify API integration returns that value for the artist. API access and returned fields depend on Spotify's current product and access rules. Do not scrape Spotify pages, infer a Spotify popularity score from follower counts, or invent missing values. Show "Not available" until an approved sync succeeds.

A separate Artist Frequency engagement score may be introduced later, but it must be labelled as the platform's own metric and its calculation disclosed.

## Credit and submission workflow

The signed credit ledger is the source of truth. Clients cannot directly write ledger records or submit credit-charged opportunities by inserting rows.

The protected `submit_artist_opportunity` RPC:
1. Requires a signed-in artist.
2. Validates required text fields, URL scheme, submission type and target.
3. Confirms the destination is verified, public, active and accepting submissions.
4. Locks the artist profile to serialize concurrent submissions.
5. Checks the current ledger balance for non-admin users.
6. Creates a pending submission and records the one-credit debit atomically.

Admin accounts bypass the balance check and debit.

The scheduled reset uses the same profile-row lock as the submission RPC, then reconciles the ledger to exactly 40 credits. A reset-run marker makes the operation idempotent for each artist and South African calendar week. The reset is scheduled at Sunday 22:05 UTC, equivalent to Monday 00:05 SAST. Never invoke the reset manually against real production balances as a test.

## Directories and matching

Directory categories include platforms, curators, playlists, radio stations, websites and bloggers. Public clients should see only entries marked public, active and verified. Recommendations should prioritise an artist's home country, then broaden by compatible genres and territories.

Only destinations that are genuinely integrated and accepting submissions may be selected for a charged submission. Do not publish fabricated contacts, approvals or opportunities.

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

The Supabase production project is linked and migrations 0001–0014 are applied. The database has 11 public tables with RLS enabled and 20 RLS policies. Table/view grants use least privilege; default privileges for future public objects are hardened; privileged and trigger-only functions have explicit execution grants. Migration 0014 adds structured artist genres and a press-kit URL.

The weekly credit reset and five-minute Marketplace publisher cron jobs are active. Marketplace publishing has successful recorded runs. The weekly reset is registered for Monday 00:05 SAST; its first scheduled execution after deployment must be confirmed from cron history.

The browser frontend now connects to the deployed backend for email/password authentication, artist profile read/update, public statistics, verified directory discovery, credit balance, credit-charged submissions, campaign create/read, Marketplace share/publication and admin Marketplace moderation. The old localStorage write handlers have been removed. JavaScript ES-module syntax and static DOM-binding checks passed. Hosted-site browser testing with anonymous, artist and admin sessions is still required before public launch; the repository is not itself a hosting deployment.

## Remaining integration gates

- Confirm email confirmation/password recovery configuration and Google OAuth provider settings.
- Complete and validate authenticated frontend workflows.
- Build protected admin tools for directory management, campaign review and weekly Top 5 selection.
- Configure the official Spotify playlist URL/ID and trusted follow-verification process before enabling badges.
- Integrate Spotify API access only when approved and available.
- Add rate limits, abuse controls, account deletion, retention procedures and audit review.
- Publish privacy, Terms, content-rights and moderation policies before public launch.
