# Artist Frequency — Platform Architecture

## Production backend

Artist Frequency uses Supabase Auth and PostgreSQL. The production project is linked to this repository, and migrations 0001–0015 have been applied.

The database contains 11 public tables, all with Row Level Security enabled, and 21 RLS policies. Explicit grants restrict browser roles to the operations required by each workflow. Public Marketplace and directory listing reads are constrained by RLS, credit balances are authenticated-only, and trusted server automation retains service-role access.

## Identity and artist profiles

1. Artists register with Supabase Auth using email/password. The browser also contains a Google OAuth flow; the Google provider and redirect allowlist must be enabled in Supabase before use.
2. An Auth database trigger creates the artist profile. A confirmed account matching the configured administrator email receives the admin role through the database trigger, not user-supplied metadata.
3. Signed-in artists can read and update their own profile. A database trigger prevents artists changing role, verification, or Spotify popularity fields.
4. Supabase sessions are persisted by the browser client. Never store passwords in application tables.

Profile data includes artist name, country, biography, genres, website, social links, an optional press-kit URL and an optional Spotify Artist URL. Migration 0014 adds the structured genre array and press-kit URL. Spotify popularity remains unavailable until a permitted Spotify API integration returns the dedicated Spotify popularity field. Do not scrape Spotify, substitute a separate platform score, or invent a value.

## Credit policy and submissions

- New non-admin artists receive 40 starter credits.
- Credits reset to exactly 40 every Monday at 00:05, Africa/Johannesburg time. Unused credits do not roll over.
- A valid playlist submission costs 1 credit.
- A valid radio-station submission costs 1 credit.
- A website-promotion submission costs 1 credit only when the destination has a deployed delivery integration and is verified, public, active and explicitly accepting submissions.
- Admin submissions are unlimited, subject to destination eligibility.

Credits are an append-only signed ledger. The browser cannot directly insert, update or delete ledger entries. The `submit_artist_opportunity` SECURITY DEFINER RPC validates the destination and payload, locks the artist profile, checks the ledger balance, creates the pending submission and records the debit in one transaction.

Migration 0015 adds `is_integrated` and `accepts_submissions` to `opportunity_directories`. Both fields default to false. The submission RPC checks both flags as well as verified/public/active status before creating a submission or charging a credit. A rejected destination request does not debit the ledger.

The directory admin UI does not expose the integration flags. They can only be enabled by a trusted backend operation after an actual delivery adapter has been deployed and verified. At present there are no destinations enabled for in-platform credit-charged dispatch. External directory links may still be opened by artists; external submissions are not charged by Artist Frequency.

The weekly reset routine takes the same per-artist profile lock before reconciling the ledger. This serializes the reset against submissions arriving at the same time and keeps the resulting balance at exactly 40. The reset is idempotent per artist and South African calendar week.

## Scheduling

The production `pg_cron` jobs are active:
- Weekly credit reset: Sunday 22:05 UTC, which is Monday 00:05 in South Africa.
- Marketplace publisher: every five minutes.

Cron uses UTC in the production project. Do not manually invoke the weekly reset against production balances as a test.

## Marketplace lifecycle

1. An authenticated artist submits a DSP link into `marketplace_tracks`; the record begins in pending moderation.
2. Admins review the queue through the protected `admin_review_marketplace_track` RPC.
3. Approval schedules publication 24 hours later.
4. The scheduled publisher advances due approved tracks to published and records internal Marketplace promotion events.
5. The weekly Top 5 is an admin-curated editorial selection, not an automated popularity ranking.

Automatic promotion means placement inside the Artist Frequency website. It does not promise external advertising, social posts, playlist additions or DSP promotion.

## Directories, campaigns and public statistics

Opportunity directories contain playlist, curator, radio, blogger, platform and website records. Public clients can read only entries that are public, active and verified. The admin page supports directory creation and update through `admin_upsert_opportunity_directory`, which requires an authenticated administrator and verification-evidence URL when marking a listing verified. Admins can publish/unpublish or deactivate a record without direct table writes.

Directory visibility is separate from submission eligibility. The admin page cannot toggle integration/acceptance flags. Only a trusted backend operation may do so after a real delivery integration has been deployed. This is intentional: a verified directory listing by itself is not proof that Artist Frequency can dispatch an artist's submission.

Artists can create campaign briefs with goals, preferred channels, countries and genres. A submitted campaign is a request for review, not a guarantee of promotion or placement.

Public statistics are database-backed aggregate counts. Do not hard-code or invent artist, platform, curator, station or blogger totals.

## Security model

- Row Level Security is enabled on all 11 public tables.
- Table and view privileges follow least-privilege grants. Anonymous access is limited to public read surfaces; browser roles cannot write to internal finance, promotion or operational tables.
- Default privileges for future tables, views, sequences and functions are hardened for the postgres migration owner. New client-facing permissions require an explicit grant.
- Privileged functions use fixed search paths and explicit execution grants. The directory upsert RPC denies anon execution and checks the current database admin role; the submission RPC denies anon execution and checks destination eligibility before debiting credits.
- Trigger-only helpers, including `set_updated_at()`, and scheduler-only routines are not directly executable by browser roles.
- The Supabase publishable/anon key may be used in browser code. Never expose a service-role key, database password, OAuth client secret or other privileged credential.
- Admin accounts should use MFA and protected recovery methods.

## Current implementation boundary

The production database, RLS, credit RPC, Marketplace moderation/publisher routine, directory admin RPC and scheduled jobs are deployed. The frontend uses a shared Supabase JS client and application module for email/password authentication, artist profile read/update, public statistics, verified directory listings, credit balance, protected submissions, campaign create/read, Marketplace share/publication, admin Marketplace moderation and admin directory management.

Browser ES-module syntax and static DOM bindings have passed checks. The full browser journey still needs testing on the hosted HTTPS site with separate anonymous, artist and admin sessions before public launch. The source repository itself is not a hosting deployment.

Playlist-follow verification remains disabled until the official Artist Frequency Spotify playlist URL/ID and trusted verification process are configured. The current protected admin page supports Marketplace track approval/decline and directory listing create/update. Campaign review and Marketplace Top 5 editorial selection still require protected admin workflows.

## Launch gates

- Configure and verify email/password, password recovery, Google OAuth (if enabled), site URLs and redirect allowlists.
- Require MFA for the administrator.
- Populate directories with legitimate records and verification evidence.
- Deploy and verify delivery adapters before enabling any in-platform submission destination.
- Finish hosted-site browser validation for authentication, profile, directory administration, submissions, campaigns and Marketplace flows.
- Build protected admin screens for campaign review and weekly Top 5 selection.
- Test anonymous, artist A, artist B, and admin access against production-like test data without manually changing production balances.
- Publish privacy, terms, copyright/rights and moderation policies, plus account deletion and data-retention procedures.
