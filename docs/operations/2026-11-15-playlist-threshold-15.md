# Playlist discovery threshold update — 15 November 2026

## Requested policy

The playlist follower minimum is now an inclusive **15 followers** threshold:

- 15 followers qualifies.
- 14 followers does not qualify.

All other checks remain in place: an individual public Spotify playlist URL, explicit active status, 0.5%–100% response rate, an HTTPS submission route, fresh primary evidence, independent second-source corroboration and matching playlist identity.

## Code changes committed

- Discovery qualification in `scripts/opportunity-discovery-core.mjs` now accepts 15+ followers.
- The candidate verification evidence describes the 15+ rule.
- Public directory cards in `src/app.js` apply the 15+ minimum, the response/activity rules, an individual Spotify URL and an HTTPS submission URL.
- Public playlist and total opportunity counts use matching filters.
- Discovery query wording now targets small, emerging and niche playlists.
- GitHub Actions now runs four searches per hourly discovery pass instead of two.
- `playlistdock.com` was added to automated-collection exclusions after its published terms explicitly prohibited scraping, reverse engineering and service disruption. Do not fetch or scrape its pages automatically.

## Verification

Local tests on the operator's Acer: **29 passed, 0 failed**.

GitHub Actions:
- Run #75 (commit `c4724c08fa8570a4b88542fd5f8f01f2fc7af73d`): success; four searches; 10 candidates seen; 0 queued; 0 published; 10 rejected; 0 errors.
- Run #76 (commit `08003bbccca5c16684e575e5711612a9efb21d2c`): success; four searches; 10 candidates seen; 0 queued; 0 published; 10 rejected; 0 errors.

Neither run reported `AUTOPUBLISH_DISABLED` or `PGRST205`. The current free Bing RSS results still mainly resolve to generic Spotify landing, login or download pages; no candidate passed every evidence gate. These are discovery failures, not successful imports.

## Current public directory audit

The anonymous read-only audit found 15 active, verified public playlist rows. Applying the new 15+ rule and the unchanged response-rate, activity, individual-Spotify-URL and HTTPS-submission checks yields **13 eligible existing playlists**. Two fail because their response rate is 0%.

The 86-follower playlist now qualifies. No claim is made that the entire target of 1,896 playlists has been sourced or verified.

## Database migration still required

The live database publication function from migration 0029 still has the old 100-follower check until migration 0030 is applied. The new worker and website code therefore should not be treated as having activated the new database publication threshold yet.

The new migration is:
`supabase/migrations/0030_playlist_minimum_followers_15.sql`

Operator's copy:
`C:\Users\USER\Downloads\ArtistFrequency_Migration_0030_15_Follower_Minimum.sql`

SHA-256:
`2c78398cbee8f53e818ef918ca51b1fd746857052eda812eaaec6d189dba85d8`

Run that file in the Supabase SQL Editor for project `mdcvewnevgsgmyfnybgn`. It safely replaces only the two database follower comparisons (candidate and evidence) and preserves the existing active-status, response-rate, Spotify URL, HTTPS route, freshness and independent-corroboration checks. It is idempotent and raises an exception rather than silently continuing if the expected old/new guards cannot be verified.

After it runs successfully, rerun the hourly workflow and confirm the exact queued/published counts. A listing counts as published only when the RPC confirms insertion into `opportunity_directories`.

## Preview

The protected Vercel preview is READY at:

`https://artist-frequency-preview-ev43fghdu.vercel.app/`

Deployment ID: `dpl_CWo1DZRXVzTvhA6aaQ7ppybqjBeu`

The preview returned HTTP 200 for both the homepage and served `src/app.js`; the served JavaScript contains the 15+ card and count filters. Production remains protected and was not promoted.
