# Artist Frequency — Global Music Submission Portal

**Motto: Music. Passion. Legacy.**

Artist Frequency is a free, artist-first music discovery, campaign and music-submission platform for independent artists worldwide.

## Product rules

- **40 free credits** on artist registration.
- Credits reset to exactly **40 every Monday at 00:05 Africa/Johannesburg time**. Months naturally contain four or five Monday resets. Unused credits do not roll over.
- **1 playlist submission = 1 credit.**
- **1 radio-station submission = 1 credit.**
- **1 integrated website-promotion submission = 1 credit.** A destination must be verified, active and accepting submissions before it can be charged.
- Admin account: **kingpinpkaytee@gmail.com**. The verified admin account has unlimited submissions.
- Artist verification requires an authorised admin/trusted integration to confirm the artist follows the official Artist Frequency Spotify playlist. This workflow remains disabled until the official playlist is configured.
- Public counters use real database counts of public artist profiles and verified, active directory entries.
- Marketplace tracks require admin approval and publish after a 24-hour delay. Automatic promotion is internal to the Artist Frequency website.
- Marketplace weekly Top 5 is an admin-curated editorial selection, not an invented popularity chart.
- Artists can create custom campaign briefs describing their desired website promotion. A campaign request does not guarantee placement.

## Production status — 9 November 2026

The Supabase production project is linked and migrations **0001–0011** are applied.

- **11/11 public tables have RLS enabled.**
- **20 RLS policies** are installed.
- Table and view grants follow least-privilege rules. Anonymous access is limited to intended public read surfaces; credit balances are authenticated-only; Marketplace listing views are read-only.
- Default privileges for future objects are hardened: new public tables/views and sequences are not automatically granted to browser roles, and new functions do not inherit PUBLIC/browser-role execution. Client-facing permissions must be granted explicitly.
- The weekly reset job is scheduled for Monday 00:05 South African time (Sunday 22:05 UTC).
- The Marketplace publisher job runs every five minutes. Its production scheduler job has completed successfully in a recorded run.
- The registration/profile trigger and credit ledger rules are deployed. The protected submission RPC validates integrated destinations and deducts credits atomically.
- No production balances or artist records were changed by the permissions migrations.

The website is still a **frontend preview with an authentication integration scaffold**, not a finished production application. The Supabase JS client includes email/password and Google OAuth flows, but provider settings and redirect URLs must be confirmed before sign-in is exposed. Dashboard, submission, campaign, moderation and directory screens still need full frontend wiring to the deployed backend.

Spotify popularity data is not fabricated or scraped. Popularity sync requires approved Spotify API access. Artist playlist-follow verification remains disabled until the official playlist URL/ID and trusted verification workflow are configured.

## Repository contents

- `index.html` — responsive frontend preview for discovery, submissions, public stats, Marketplace, weekly Top 5, campaign planning, artist profile and sign-in entry points.
- `supabase/migrations/0001_core_platform.sql` — core schema, credit-balance view and initial RLS.
- `supabase/migrations/0002_artist_frequency_features.sql` — artist features, directories, campaigns, Marketplace, weekly Top 5 and public views.
- `supabase/migrations/0003_signup_and_public_stats_hardening.sql` — confirmed-email profile/grant handling and aggregate-stat view hardening.
- `supabase/migrations/0004_submission_credits_and_verification.sql` — one-credit submission RPC and admin playlist-follow verification.
- `supabase/migrations/0005_campaign_and_admin_policy_fixes.sql` — campaign and admin policy corrections.
- `supabase/migrations/0006_security_and_credit_hardening.sql` — submission concurrency, validation and privileged RPC hardening.
- `supabase/migrations/0007_restrict_trigger_function_execution.sql` — trigger-only function execution restrictions.
- `supabase/migrations/0008_install_scheduler_jobs.sql` — weekly credit reset and Marketplace publishing jobs.
- `supabase/migrations/0009_least_privilege_artist_finance.sql` — least-privilege table grants.
- `supabase/migrations/0010_least_privilege_view_grants.sql` — explicit read-only grants for public views and authenticated-only credit balances.
- `supabase/migrations/0011_harden_default_privileges.sql` — least-privilege defaults for future tables, views, sequences and functions.
- `src/auth.js` — Supabase JS v2 email registration, password sign-in and Google OAuth client.
- `supabase-config.js` — public Supabase URL and publishable key only; never place a service-role key here.
- `docs/PLATFORM_ARCHITECTURE.md` — backend and security architecture.
- `docs/PRODUCT_RULES_AND_INTEGRATIONS.md` — confirmed rules and integration requirements.
- `docs/PHASE_4_SUPABASE_SETUP.md` — setup guidance for a new Supabase environment.

## Setup and operational requirements

For a **new** Supabase environment, apply migrations in numeric order and then verify the resulting grants, RLS policies and scheduled jobs. The production project already has migrations 0001–0011 applied.

- Enable and verify email/password and Google OAuth providers; configure the Google Cloud OAuth client and Supabase redirect allowlist.
- Keep service-role keys, database passwords and OAuth client secrets server-side. The browser may use only the publishable/anon key.
- New public tables, views, sequences and functions require explicit client grants when a browser-facing workflow needs them.
- Keep the Monday credit reset and five-minute Marketplace publisher schedules enabled.
- Configure the official Artist Frequency Spotify playlist and authorised verification workflow before enabling playlist-follow verification.
- Populate directories only with verified, active and permission-appropriate opportunities.
- Publish privacy, terms, content-rights and moderation policies before launch.

## Further documentation

See `docs/PRODUCT_RULES_AND_INTEGRATIONS.md`, `docs/PLATFORM_ARCHITECTURE.md` and `docs/ADMIN_OPERATIONS.md`.

**Artist Frequency**  
*Music. Passion. Legacy.*
