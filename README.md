# Artist Frequency — Global Music Submission Portal

**Motto: Music. Passion. Legacy.**

Artist Frequency is a free, artist-first music discovery, campaign and music-submission platform for independent artists worldwide.

## Product rules confirmed

- **40 free credits** on artist registration.
- Credits reset to exactly **40 every Monday at 00:05 Africa/Johannesburg time**. Months naturally contain four or five Monday resets. Unused credits do not roll over.
- **1 playlist submission = 1 credit.**
- **1 radio-station submission = 1 credit.**
- **1 integrated website-promotion submission = 1 credit.** A website destination must be verified, active and accepting submissions before it can be charged.
- Admin account: **kingpinpkaytee@gmail.com**. The verified admin account has unlimited submissions.
- Artists can provide a Spotify Artist profile link and supplementary artist information.
- Artist verification is awarded only after an authorised admin/trusted integration verifies that the artist follows the official Artist Frequency Spotify playlist.
- Public counters display registered artists, platforms, curators, radio stations and bloggers from real database records.
- Marketplace shares require admin approval. Approved songs are published and promoted inside the Artist Frequency website after a 24-hour delay.
- Marketplace weekly Top 5 is an editorial selection, not an invented popularity chart.
- Artists can create custom promotion campaign briefs describing how they want the website to promote their music.

## Repository contents

- `index.html` — responsive frontend preview: discovery, submission, public-stat placeholders, marketplace, weekly Top 5, campaign planner, artist profile, and sign-in entry points.
- `supabase/migrations/0001_core_platform.sql` — artist profiles, submissions, credit ledger and initial RLS.
- `supabase/migrations/0002_artist_frequency_features.sql` — weekly credits, admin role, verification, directories, campaigns, marketplace and public views.
- `supabase/migrations/0003_signup_and_public_stats_hardening.sql` — confirmed-email profile/grant handling and aggregate-stat view hardening.
- `supabase/migrations/0004_submission_credits_and_verification.sql` — one-credit submission RPC and admin playlist-follow verification.
- `docs/PLATFORM_ARCHITECTURE.md` — backend and security architecture.
- `docs/PRODUCT_RULES_AND_INTEGRATIONS.md` — confirmed rules and integration requirements.
- `.env.example` — public-client configuration placeholders only.

## Current implementation status

The website currently remains a **static frontend preview**. Its local forms save only in the visitor's browser. The Supabase migrations and RPCs are prepared source code and have **not** been applied to a live project. Email sign-up, Google sign-in, real credits, live statistics, Spotify popularity sync, verification, moderation queues, campaign submission and automatic marketplace publishing are not active until the backend and scheduled jobs are configured.

## Important integration requirements

- Create/connect a Supabase project and apply migrations in numeric order.
- Enable email/password and Google OAuth in Supabase Auth; configure Google Cloud OAuth redirect URLs.
- Keep privileged keys server-side. Never put the Supabase service-role key in browser code.
- Schedule the Monday 00:05 South African credit reset and marketplace publishing worker.
- Connect Spotify API access only where approved and available. Never scrape Spotify or invent popularity scores.
- Configure the official Artist Frequency Spotify playlist URL and admin verification workflow.
- Populate platform, curator, playlist, radio and blogger directories with verified, permission-appropriate entries.
- Publish privacy, terms, content-rights and moderation policies before launch.

## Further documentation

See `docs/PRODUCT_RULES_AND_INTEGRATIONS.md` and `docs/PLATFORM_ARCHITECTURE.md` before connecting production credentials.

**Artist Frequency**  
*Music. Passion. Legacy.*
