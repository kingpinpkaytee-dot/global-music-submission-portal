# Artist Frequency — Global Music Submission Portal

**Motto: Music. Passion. Legacy.**

Artist Frequency is a free, artist-first music discovery, campaign and music-submission platform for independent artists worldwide.

## Product rules

- **40 free credits** on artist registration.
- Credits reset to exactly **40 every Monday at 00:05 Africa/Johannesburg time**. Months naturally contain four or five Monday resets. Unused credits do not roll over.
- **1 integrated playlist submission = 1 credit**, only when its destination has a deployed delivery integration and is verified, public, active and accepting submissions.
- **1 integrated radio-station submission = 1 credit**, only when its destination has a deployed delivery integration and is verified, public, active and accepting submissions.
- **1 integrated website-promotion submission = 1 credit**, only when its destination has a working delivery integration and is verified, public, active and explicitly accepting submissions.
- Admin account: **kingpinpkaytee@gmail.com**. The verified admin account has unlimited credits, subject to destination eligibility.
- Artist verification requires an authorised admin/trusted integration to confirm the artist follows the official Artist Frequency Spotify playlist. This workflow remains disabled until the official playlist is configured.
- Public counters use real database counts of public artist profiles and verified, active directory entries.
- Marketplace tracks require admin approval and publish after a 24-hour delay. Automatic promotion is internal to the Artist Frequency website.
- Marketplace weekly Top 5 is an admin-curated editorial selection, not an invented popularity chart.
- Artists can create custom campaign briefs describing their desired website promotion. A campaign request does not guarantee placement.

## Production status — 9 November 2026

The Supabase production project is linked. Migrations **0001–0015** were previously confirmed applied; later discovery, payment and opportunity batches **0016–0025** are committed in the repository and must be checked against the production migration history before applying any missing migrations, in numeric order.

- **11/11 public tables have RLS enabled.**
- **21 RLS policies** are installed.
- Table and view grants follow least-privilege rules. Anonymous access is limited to intended public read surfaces; credit balances are authenticated-only; Marketplace listing views are read-only.
- Default privileges for future objects are hardened: new public tables/views and sequences are not automatically granted to browser roles, and new functions do not inherit PUBLIC/browser-role execution. Client-facing permissions must be granted explicitly.
- The weekly reset job is scheduled for Monday 00:05 South African time (Sunday 22:05 UTC).
- The Marketplace publisher job runs every five minutes. Its production scheduler job has completed successfully in a recorded run.
- The registration/profile trigger and credit ledger rules are deployed. The protected submission RPC validates integrated destinations and deducts credits atomically.
- Weekly resets take the same per-artist profile-row lock as credit-charged submissions, so a submission racing the Monday reset cannot leave an off-by-one balance.
- Migration 0014 adds structured artist genres and a press-kit URL to artist profiles.
- Migration 0015 adds explicit integration/acceptance gates for directory destinations and protected admin directory management. Both submission flags default to false.
- No production balances or artist records were changed by the permissions migrations.

## Live frontend integration

The single-page frontend now uses the shared Supabase JS v2 client in `src/supabase-client.js` and the application layer in `src/app.js`. The old browser-localStorage submission, Marketplace share, campaign and artist-profile write handlers have been removed.

## Dashboard navigation

The Dashboard is a workspace launcher rather than one continuous spreadsheet-style page. Each selection opens a dedicated browser tab using its own `?view=` route: submissions and credits, opportunity discovery, Marketplace, campaign planner, artist profile, account/sign-in, community statistics and the admin workspace. Each focused view includes a return-to-Dashboard link. The administrator selection is shown only after the signed-in profile confirms the admin role; database policies and RPC checks remain the authority for protected actions.

Connected frontend flows include:
- Email/password sign-up and sign-in through Supabase Auth, session persistence and sign-out.
- Artist profile read/update, including artist name, country, biography, genres, website/social links, Spotify Artist URL and press-kit URL.
- Live public platform statistics and verified directory listings.
- Credit balance from the ledger-backed balance view.
- Credit-charged playlist, radio, website, curator, platform and contact submissions through the protected `submit_artist_opportunity` RPC, subject to a deployed delivery adapter and explicit destination acceptance.
- Artist campaign creation and retrieval.
- Marketplace release sharing, public published-track/weekly Top 5 display, and a restricted admin Marketplace approval/decline queue.
- Protected admin directory create/update, verification-evidence recording, listing publication and deactivation. Integration/acceptance flags are not user-editable and remain locked until a delivery adapter is deployed.

Public directory counts are database-derived. Migration 0021 contains a previous public opportunity seed batch; verify the live database before quoting totals. The new migration 0024 batch is private and pending review. Credit-charged in-platform dispatch remains disabled until actual delivery adapters are deployed and enabled by trusted backend operations.

Google OAuth still requires its provider and redirect URL to be configured in Supabase Auth. The browser code includes the OAuth flow, but availability must be confirmed in the Supabase dashboard. Spotify popularity is shown only from the dedicated `spotify_popularity` API field; no scraped or invented score is used. Playlist-follow verification remains disabled until the official playlist URL/ID and trusted verification process are configured.

The frontend has passed JavaScript ES-module syntax checks and a static DOM-binding check. The isolated Vercel project `artist-frequency-preview` now hosts the latest committed source; HTTP checks returned 200 for the page and all four JavaScript/config assets, including the new directory admin screen. The preview is SSO-protected. Full browser sign-up/sign-in and end-to-end artist/admin workflows still need to be exercised with separate test accounts. No public production launch has been approved.

## Repository contents

- `index.html` — responsive portal UI for discovery, submissions, live stats, Marketplace, weekly Top 5, campaigns, artist profile and sign-in.
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
- `supabase/migrations/0012_serialize_weekly_credit_reset.sql` — per-artist locking to serialize weekly resets against credit-charged submissions.
- `supabase/migrations/0013_restrict_updated_at_trigger_execution.sql` — removes direct browser-role execution of the updated-at trigger helper.
- `supabase/migrations/0014_artist_profile_genres_and_press_kit.sql` — structured artist genre and press-kit fields.
- `supabase/migrations/0015_secure_opportunity_directory_acceptance.sql` — integration and acceptance gates, admin directory RPC and credit-spend eligibility checks.
- `supabase/migrations/0016_opportunity_discovery_intelligence.sql` — private discovery runs and reviewable candidates.
- `supabase/migrations/0022_hourly_opportunity_discovery.sql` — hourly discovery audit trail.
- `supabase/migrations/0023_expand_submission_destinations.sql` — curator, promotion-platform and industry-contact categories, plus protected submission eligibility checks.
- `supabase/migrations/0024_google_search_submission_candidates.sql` — Google Search research candidates for admin review; no automatic public publication.
- `supabase/migrations/0025_admin_candidate_review.sql` — protected admin-only approval/rejection RPC; accepted listings are public but remain non-integrated.
- `src/supabase-client.js` — one shared Supabase client and safe public-key configuration check.
- `src/auth.js` — email/password, Google OAuth, session handling and sign-out.
- `src/app.js` — live public data, artist dashboard, submissions, campaigns, Marketplace and admin moderation integration.
- `supabase-config.js` — public Supabase URL and publishable key only; never place a service-role key here.
- `docs/PLATFORM_ARCHITECTURE.md` — backend and security architecture.
- `docs/PRODUCT_RULES_AND_INTEGRATIONS.md` — confirmed rules and integration requirements.
- `docs/PHASE_4_SUPABASE_SETUP.md` — setup guidance for a new Supabase environment.
- `docs/VERCEL_DEPLOYMENT.md` — Vercel project, protected preview and production-pause status.

## Setup and operational requirements

For a **new** Supabase environment, apply migrations in numeric order and then verify the resulting grants, RLS policies and scheduled jobs. The production project already has migrations 0001–0015 applied.

- Enable and verify email/password and Google OAuth providers; configure the Google Cloud OAuth client and Supabase redirect allowlist.
- Serve the frontend over HTTPS and set the exact Site URL and allowed redirect URLs in Supabase Auth.
- Keep service-role keys, database passwords and OAuth client secrets server-side. The browser may use only the publishable/anon key.
- New public tables, views, sequences and functions require explicit client grants when a browser-facing workflow needs them.
- Keep the Monday credit reset and five-minute Marketplace publisher schedules enabled.
- Configure the official Artist Frequency Spotify playlist and authorised verification workflow before enabling playlist-follow verification.
- Populate directories only with verified, active and permission-appropriate opportunities.
- Complete protected admin tools for campaign review and weekly Top 5 selection; directory creation/update and Marketplace moderation are already available in the admin workspace.
- Publish privacy, terms, content-rights and moderation policies before public launch.

## Vercel hosting state

The canonical `artist-frequency` Vercel project remains paused, so its production domain cannot serve an untested release. The latest code is available in a separate SSO-protected project named `artist-frequency-preview` (`artist-frequency-preview-qvxljsysr.vercel.app`). Vercel reports that deployment as the Production target within this isolated preview-named project; it is not the canonical production site. Vercel automatic GitHub deployments remain pending a GitHub Login Connection under Vercel account Settings → Authentication. Do not unpause the canonical project or assign its production domain until hosted-browser validation is complete and production release is authorised.

## Further documentation

See `docs/PRODUCT_RULES_AND_INTEGRATIONS.md`, `docs/PLATFORM_ARCHITECTURE.md`, `docs/ADMIN_OPERATIONS.md`, `docs/AUTONOMOUS_OPPORTUNITY_DISCOVERY.md` and `docs/VERCEL_DEPLOYMENT.md`.

**Artist Frequency**  
*Music. Passion. Legacy.*


## Autonomous opportunity discovery and publication

The hourly worker now uses the DataForSEO Google Organic Live Advanced API rather than Google Custom Search JSON, Bing RSS or Google News RSS. Search tasks rotate through a 48-query Spotify-curator pool, with one task per hourly run by default and up to 20 organic results per task. The worker inspects the actual publisher page and stores publisher-page-derived metadata; raw search snippets are transient and are not written into candidate records or run logs.

The automated publication scope is currently Spotify playlists only. A listing can be published without admin intervention only when it has an individual public Spotify playlist URL, strictly more than 100 followers, explicit active status, a 0.5%–100% response rate, a live HTTPS submission form/portal route, a reachable publisher page and a reachable independent source on a different registrable domain corroborating the same playlist identity. All genres remain eligible; genre extraction is informational, not a filter.

The worker rotates one query per hour through 48 targeted queries. At the published DataForSEO Live SERP rate of $0.002 per 10 results, a depth of 20 is approximately $0.004 per hourly task (about $2.88 per 30 days of hourly runs); the exact task cost is returned by DataForSEO and logged per run. A DataForSEO account and API credentials are required. See docs/AUTONOMOUS_OPPORTUNITY_DISCOVERY.md for provider terms, setup, gates and testing.

The worker never publishes a candidate solely because a search result exists. Missing metrics, an uncertain activity state, an unsafe destination, a missing HTTPS submission route or a failed playlist-identity corroboration blocks autonomous publication. Candidates that pass the hard playlist metrics and route but lack independent corroboration remain private for review. Search snippets are not stored.

Migrations 0028 and 0029 are required for unattended publication. Migration 0028 adds structured verification evidence and the service-role-only publication RPC. Migration 0029 adds the version-2 runtime policy gate, exact Spotify URL checks, strict follower/activity/response-rate checks, independent-domain corroboration checks, duplicate serialization and preservation of the non-integrated/non-accepting state. The worker will keep public publication disabled until the production database reports policy version 2. The last verified production logs still showed the 0028 column missing; repository commits do not apply Supabase migrations.

Published directory records remain external reference listings only: is_integrated=false and accepts_submissions=false. This automation does not send artist music, dispatch emails, follow playlists, create streams or deduct credits. Spotify playlist metadata is linked back to Spotify; the worker does not scrape playlist contents or use Spotify content to train models.

## Publication safety history

Migration 0026 introduced an admin bulk-publish RPC. Migration 0027 disabled that bulk-publish path at the database boundary. The new autonomous route is a separate, service-role-only RPC with stricter evidence checks; it does not re-enable the admin bulk-publish RPC.
## Opportunity publication batch (migrations 0026–0029)

Migration 0026 introduced an admin-only bulk-publish RPC, and migration 0027 disabled that route. Migrations 0028–0029 define the new controlled autonomous playlist-publication policy. Production must apply 0028 and 0029 in numeric order before the worker can publish. GitHub commits alone do not apply Supabase migrations or deploy the website.

**Motto: Music. Passion. Legacy.**

Artist Frequency is a free, artist-first music discovery, campaign and music-submission platform for independent artists worldwide.

## Product rules

- **40 free credits** on artist registration.
- Credits reset to exactly **40 every Monday at 00:05 Africa/Johannesburg time**. Months naturally contain four or five Monday resets. Unused credits do not roll over.
- **1 integrated playlist submission = 1 credit**, only when its destination has a deployed delivery integration and is verified, public, active and accepting submissions.
- **1 integrated radio-station submission = 1 credit**, only when its destination has a deployed delivery integration and is verified, public, active and accepting submissions.
- **1 integrated website-promotion submission = 1 credit**, only when its destination has a working delivery integration and is verified, public, active and explicitly accepting submissions.
- Admin account: **kingpinpkaytee@gmail.com**. The verified admin account has unlimited credits, subject to destination eligibility.
- Artist verification requires an authorised admin/trusted integration to confirm the artist follows the official Artist Frequency Spotify playlist. This workflow remains disabled until the official playlist is configured.
- Public counters use real database counts of public artist profiles and verified, active directory entries.
- Marketplace tracks require admin approval and publish after a 24-hour delay. Automatic promotion is internal to the Artist Frequency website.
- Marketplace weekly Top 5 is an admin-curated editorial selection, not an invented popularity chart.
- Artists can create custom campaign briefs describing their desired website promotion. A campaign request does not guarantee placement.

## Production status — 9 November 2026

The Supabase production project is linked. Migrations **0001–0015** were previously confirmed applied; later discovery, payment and opportunity batches **0016–0025** are committed in the repository and must be checked against the production migration history before applying any missing migrations, in numeric order.

- **11/11 public tables have RLS enabled.**
- **21 RLS policies** are installed.
- Table and view grants follow least-privilege rules. Anonymous access is limited to intended public read surfaces; credit balances are authenticated-only; Marketplace listing views are read-only.
- Default privileges for future objects are hardened: new public tables/views and sequences are not automatically granted to browser roles, and new functions do not inherit PUBLIC/browser-role execution. Client-facing permissions must be granted explicitly.
- The weekly reset job is scheduled for Monday 00:05 South African time (Sunday 22:05 UTC).
- The Marketplace publisher job runs every five minutes. Its production scheduler job has completed successfully in a recorded run.
- The registration/profile trigger and credit ledger rules are deployed. The protected submission RPC validates integrated destinations and deducts credits atomically.
- Weekly resets take the same per-artist profile-row lock as credit-charged submissions, so a submission racing the Monday reset cannot leave an off-by-one balance.
- Migration 0014 adds structured artist genres and a press-kit URL to artist profiles.
- Migration 0015 adds explicit integration/acceptance gates for directory destinations and protected admin directory management. Both submission flags default to false.
- No production balances or artist records were changed by the permissions migrations.

## Live frontend integration

The single-page frontend now uses the shared Supabase JS v2 client in `src/supabase-client.js` and the application layer in `src/app.js`. The old browser-localStorage submission, Marketplace share, campaign and artist-profile write handlers have been removed.

## Dashboard navigation

The Dashboard is a workspace launcher rather than one continuous spreadsheet-style page. Each selection opens a dedicated browser tab using its own `?view=` route: submissions and credits, opportunity discovery, Marketplace, campaign planner, artist profile, account/sign-in, community statistics and the admin workspace. Each focused view includes a return-to-Dashboard link. The administrator selection is shown only after the signed-in profile confirms the admin role; database policies and RPC checks remain the authority for protected actions.

Connected frontend flows include:
- Email/password sign-up and sign-in through Supabase Auth, session persistence and sign-out.
- Artist profile read/update, including artist name, country, biography, genres, website/social links, Spotify Artist URL and press-kit URL.
- Live public platform statistics and verified directory listings.
- Credit balance from the ledger-backed balance view.
- Credit-charged playlist, radio, website, curator, platform and contact submissions through the protected `submit_artist_opportunity` RPC, subject to a deployed delivery adapter and explicit destination acceptance.
- Artist campaign creation and retrieval.
- Marketplace release sharing, public published-track/weekly Top 5 display, and a restricted admin Marketplace approval/decline queue.
- Protected admin directory create/update, verification-evidence recording, listing publication and deactivation. Integration/acceptance flags are not user-editable and remain locked until a delivery adapter is deployed.

Public directory counts are database-derived. Migration 0021 contains a previous public opportunity seed batch; verify the live database before quoting totals. The new migration 0024 batch is private and pending review. Credit-charged in-platform dispatch remains disabled until actual delivery adapters are deployed and enabled by trusted backend operations.

Google OAuth still requires its provider and redirect URL to be configured in Supabase Auth. The browser code includes the OAuth flow, but availability must be confirmed in the Supabase dashboard. Spotify popularity is shown only from the dedicated `spotify_popularity` API field; no scraped or invented score is used. Playlist-follow verification remains disabled until the official playlist URL/ID and trusted verification process are configured.

The frontend has passed JavaScript ES-module syntax checks and a static DOM-binding check. The isolated Vercel project `artist-frequency-preview` now hosts the latest committed source; HTTP checks returned 200 for the page and all four JavaScript/config assets, including the new directory admin screen. The preview is SSO-protected. Full browser sign-up/sign-in and end-to-end artist/admin workflows still need to be exercised with separate test accounts. No public production launch has been approved.

## Repository contents

- `index.html` — responsive portal UI for discovery, submissions, live stats, Marketplace, weekly Top 5, campaigns, artist profile and sign-in.
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
- `supabase/migrations/0012_serialize_weekly_credit_reset.sql` — per-artist locking to serialize weekly resets against credit-charged submissions.
- `supabase/migrations/0013_restrict_updated_at_trigger_execution.sql` — removes direct browser-role execution of the updated-at trigger helper.
- `supabase/migrations/0014_artist_profile_genres_and_press_kit.sql` — structured artist genre and press-kit fields.
- `supabase/migrations/0015_secure_opportunity_directory_acceptance.sql` — integration and acceptance gates, admin directory RPC and credit-spend eligibility checks.
- `supabase/migrations/0016_opportunity_discovery_intelligence.sql` — private discovery runs and reviewable candidates.
- `supabase/migrations/0022_hourly_opportunity_discovery.sql` — hourly discovery audit trail.
- `supabase/migrations/0023_expand_submission_destinations.sql` — curator, promotion-platform and industry-contact categories, plus protected submission eligibility checks.
- `supabase/migrations/0024_google_search_submission_candidates.sql` — Google Search research candidates for admin review; no automatic public publication.
- `supabase/migrations/0025_admin_candidate_review.sql` — protected admin-only approval/rejection RPC; accepted listings are public but remain non-integrated.
- `src/supabase-client.js` — one shared Supabase client and safe public-key configuration check.
- `src/auth.js` — email/password, Google OAuth, session handling and sign-out.
- `src/app.js` — live public data, artist dashboard, submissions, campaigns, Marketplace and admin moderation integration.
- `supabase-config.js` — public Supabase URL and publishable key only; never place a service-role key here.
- `docs/PLATFORM_ARCHITECTURE.md` — backend and security architecture.
- `docs/PRODUCT_RULES_AND_INTEGRATIONS.md` — confirmed rules and integration requirements.
- `docs/PHASE_4_SUPABASE_SETUP.md` — setup guidance for a new Supabase environment.
- `docs/VERCEL_DEPLOYMENT.md` — Vercel project, protected preview and production-pause status.

## Setup and operational requirements

For a **new** Supabase environment, apply migrations in numeric order and then verify the resulting grants, RLS policies and scheduled jobs. The production project already has migrations 0001–0015 applied.

- Enable and verify email/password and Google OAuth providers; configure the Google Cloud OAuth client and Supabase redirect allowlist.
- Serve the frontend over HTTPS and set the exact Site URL and allowed redirect URLs in Supabase Auth.
- Keep service-role keys, database passwords and OAuth client secrets server-side. The browser may use only the publishable/anon key.
- New public tables, views, sequences and functions require explicit client grants when a browser-facing workflow needs them.
- Keep the Monday credit reset and five-minute Marketplace publisher schedules enabled.
- Configure the official Artist Frequency Spotify playlist and authorised verification workflow before enabling playlist-follow verification.
- Populate directories only with verified, active and permission-appropriate opportunities.
- Complete protected admin tools for campaign review and weekly Top 5 selection; directory creation/update and Marketplace moderation are already available in the admin workspace.
- Publish privacy, terms, content-rights and moderation policies before public launch.

## Vercel hosting state

The canonical `artist-frequency` Vercel project remains paused, so its production domain cannot serve an untested release. The latest code is available in a separate SSO-protected project named `artist-frequency-preview` (`artist-frequency-preview-qvxljsysr.vercel.app`). Vercel reports that deployment as the Production target within this isolated preview-named project; it is not the canonical production site. Vercel automatic GitHub deployments remain pending a GitHub Login Connection under Vercel account Settings → Authentication. Do not unpause the canonical project or assign its production domain until hosted-browser validation is complete and production release is authorised.

## Further documentation

See `docs/PRODUCT_RULES_AND_INTEGRATIONS.md`, `docs/PLATFORM_ARCHITECTURE.md`, `docs/ADMIN_OPERATIONS.md` and `docs/VERCEL_DEPLOYMENT.md`.

**Artist Frequency**  
*Music. Passion. Legacy.*


## Autonomous opportunity discovery and publication

The hourly worker now uses the DataForSEO Google Organic Live Advanced API rather than Google Custom Search JSON, Bing RSS or Google News RSS. Search tasks rotate through a 48-query Spotify-curator pool, with one task per hourly run by default and up to 20 organic results per task. The worker inspects the actual publisher page and stores publisher-page-derived metadata; raw search snippets are transient and are not written into candidate records or run logs.

The automated publication scope is currently Spotify playlists only. A listing can be published without admin intervention only when it has an individual public Spotify playlist URL, strictly more than 100 followers, explicit active status, a 0.5%–100% response rate, a live HTTPS submission form/portal route, a reachable publisher page and a reachable independent source on a different registrable domain corroborating the same playlist identity. All genres remain eligible; genre extraction is informational, not a filter.

The worker rotates one query per hour through 48 targeted queries. At the published DataForSEO Live SERP rate of $0.002 per 10 results, a depth of 20 is approximately $0.004 per hourly task (about $2.88 per 30 days of hourly runs); the exact task cost is returned by DataForSEO and logged per run. A DataForSEO account and API credentials are required. See docs/AUTONOMOUS_OPPORTUNITY_DISCOVERY.md for provider terms, setup, gates and testing.

The worker never publishes a candidate solely because a search result exists. Missing metrics, an uncertain activity state, an unsafe destination, a missing HTTPS submission route or a failed playlist-identity corroboration blocks autonomous publication. Candidates that pass the hard playlist metrics and route but lack independent corroboration remain private for review. Search snippets are not stored.

Migrations 0028 and 0029 are required for unattended publication. Migration 0028 adds structured verification evidence and the service-role-only publication RPC. Migration 0029 adds the version-2 runtime policy gate, exact Spotify URL checks, strict follower/activity/response-rate checks, independent-domain corroboration checks, duplicate serialization and preservation of the non-integrated/non-accepting state. The worker will keep public publication disabled until the production database reports policy version 2. The last verified production logs still showed the 0028 column missing; repository commits do not apply Supabase migrations.

Published directory records remain external reference listings only: is_integrated=false and accepts_submissions=false. This automation does not send artist music, dispatch emails, follow playlists, create streams or deduct credits. Spotify playlist metadata is linked back to Spotify; the worker does not scrape playlist contents or use Spotify content to train models.

## Publication safety history

Migration 0026 introduced an admin bulk-publish RPC. Migration 0027 disabled that bulk-publish path at the database boundary. The new autonomous route is a separate, service-role-only RPC with stricter evidence checks; it does not re-enable the admin bulk-publish RPC.
## Opportunity publication batch (migrations 0026–0029)

Migration 0026 introduced an admin-only bulk-publish RPC, and migration 0027 disabled that route. Migrations 0028–0029 define the new controlled autonomous playlist-publication policy. Production must apply 0028 and 0029 in numeric order before the worker can publish. GitHub commits alone do not apply Supabase migrations or deploy the website.
