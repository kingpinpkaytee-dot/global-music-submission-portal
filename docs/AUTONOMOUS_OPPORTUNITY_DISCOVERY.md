# Autonomous opportunity discovery and publication

## What the worker does

The scheduled GitHub Actions worker discovers public Spotify playlist curator pages, inspects the publisher's own page, extracts a direct playlist and a live submission route, checks the required metrics, finds an independently hosted source that corroborates the same playlist identity, and writes the result to Supabase.

The public website reads the directory from Supabase. A successfully published directory row is visible on the website without a separate content upload or manual admin action.

This automation publishes opportunity directory records only. It does not submit DiggerMan or another artist's music to curators, send emails, follow playlists, create Spotify streams, deduct artist credits, or enable in-platform delivery.

## Search provider and operating cost

The worker has been reverted to Google's public News RSS search endpoint. It requires no paid API, no API account, no card and no DataForSEO credentials. The scheduled worker rotates through the existing 57-query pool and resolves Google News article links to direct publisher pages before inspecting them.

This is a constrained, zero-search-fee fallback, not a full Google Web Search API. Google News is news-focused, so curator discovery coverage may be narrower and candidate yield may be lower than a general web index. Microsoft retired its public Bing Search APIs on 11 August 2025, so the old Bing Search API is not a valid free fallback. The worker does not scrape Google's Search HTML interface.

RSS titles, snippets and feed metadata are transient search inputs. The worker persists only metadata extracted from the inspected publisher page and its own verification evidence. A Google News result that cannot be resolved to a direct publisher page is rejected. Provider cost is logged as USD 0; page inspection is limited by the existing runtime and per-run corroboration budgets.

No paid search provider is configured or called. Do not create DataForSEO credentials or fund a search account while the project is operating in this zero-budget mode.

## Autonomous playlist publication gates

A playlist may be published without admin intervention only when every condition passes:

1. A direct public Spotify playlist URL is present.
2. The playlist has strictly more than 100 followers.
3. The curator or playlist is explicitly shown as active.
4. The response rate is at least 0.5% and no more than 100%.
5. A live HTTPS submission form or portal route is identified from the publisher's own page.
6. The publisher page is reachable and exposes its own page title and music-submission context.
7. A second reachable source on a different registrable domain corroborates the same playlist identity and playlist/curator category.
8. The candidate's evidence is fresh and satisfies the versioned database publication policy.

All genres remain eligible. Genre labels are extracted for discovery/display only; there is no genre exclusion rule.

Missing metrics, uncertain activity, missing route, unsafe URL, or missing independent corroboration means no automatic publication. Candidates that pass the basic playlist metrics and route but lack second-source corroboration remain private in the review queue. Candidates that fail the user's hard metrics/route requirements are rejected.

## Safety and reliability controls

- Search query rotation spreads the territory/platform coverage across hourly runs.
- One search task per run is the default; the workflow caps the configurable setting at two.
- Independent-source inspection is capped at ten attempts per run, with no more than two attempts for one candidate to control runtime and cost.
- Only HTTP(S) URLs are accepted; URL credentials, IP-literal hosts, localhost/private destinations and unsafe redirect targets are blocked.
- Redirects are followed manually with a five-hop limit; page reads are capped at 250 KB.
- Search-result snippets are not persisted.
- Duplicate checks are performed before candidate insertion; the publication RPC serializes duplicate checks for the same Spotify playlist.
- The database RPC is callable only by service_role.
- Public records are inserted as verified/active/public but always is_integrated=false and accepts_submissions=false.
- Automatic publication is enabled only when opportunity_discovery_runtime_config.publication_policy_version = 2.

## Required one-time setup

Add only the existing server-side secret in GitHub Settings → Secrets and variables → Actions:

- SUPABASE_SERVICE_ROLE_KEY — existing Supabase server-side secret/service-role key.

The Supabase project URL is already configured in the workflow. No search-provider API credentials are required. Never add server-side credentials to frontend files, VITE_ variables, source control, or public issue comments.

## Required database setup

Apply these migrations in Supabase SQL Editor, in this order, after confirming the prior migrations are present:

1. 0028_autonomous_verified_opportunity_publication.sql
2. 0029_harden_autonomous_playlist_publication.sql

Migration 0029 creates the version-2 runtime policy record and replaces the publication RPC with stronger database-side checks. Until that migration is applied, the worker may continue discovery and private candidate staging, but public autonomous publication stays disabled.

Do not apply migrations blindly if the production migration history is inconsistent. Check the migration history first and apply only missing migrations in numeric order.

## Test sequence

The workflow automatically runs the built-in Node test suite before any search request. The tests cover:

- Google News RSS parsing and unsafe-result rejection;
- playlist-name extraction from the exact Spotify link;
- direct form and portal route extraction;
- newsletter-form and unrelated-link rejection;
- registrable-domain comparison;
- unsafe URL and IP-literal blocking;
- follower, activity, response-rate and HTTPS-route thresholds;
- boundary values (101 followers, 0.5% and 100% response rate).

After secrets and migrations are configured, trigger the workflow once manually. Inspect the run's provider cost, search count, candidates examined, rejected reasons, independent corroboration outcomes, publication result and unaccounted count. A successful GitHub job alone is not proof that an opportunity was published; the worker must log recordsPublished and the matching directory row must appear on the website.

## Current implementation limits

- The automated public publication policy currently supports Spotify playlist opportunities only. Other DSP playlist types are deliberately excluded from automatic publication until their metrics and verification rules are separately defined.
- Radio, blogger, curator and platform directories are not auto-published by this worker.
- Spotify's Web API cannot be relied on to retrieve the contents of arbitrary third-party playlists; the worker does not scrape Spotify playlist contents or infer missing curator metrics from Spotify.
- A public directory listing is not an endorsement or a promise of playlist placement, airplay or response.
