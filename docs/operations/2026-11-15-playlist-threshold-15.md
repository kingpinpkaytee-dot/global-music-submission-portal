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

## Verification before database migration 0030

Local tests on the operator's Acer: **29 passed, 0 failed**.

GitHub Actions:
- Run #75 (commit `c4724c08fa8570a4b88542fd5f8f01f2fc7af73d`): success; four searches; 10 candidates seen; 0 queued; 0 published; 10 rejected; 0 errors.
- Run #76 (commit `08003bbccca5c16684e575e5711612a9efb21d2c`): success; four searches; 10 candidates seen; 0 queued; 0 published; 10 rejected; 0 errors.
- Run #77 (documentation commit `a03585e9ffebcffb71ddc37048da130138e045eb`): success; four searches; 10 candidates seen; 0 queued; 0 published; 10 rejected; 0 errors.

Those runs did not report `AUTOPUBLISH_DISABLED` or `PGRST205`. The free Bing RSS results mainly resolved to generic Spotify landing, login, download or app-link pages; no candidate passed every evidence gate. These are discovery failures, not successful imports.

## Current public directory audit

The anonymous read-only audit found 15 active, verified public playlist rows. Applying the new 15+ rule and the unchanged response-rate, activity, individual-Spotify-URL and HTTPS-submission checks yields **13 eligible existing playlists**. Two fail because their response rate is 0%.

The 86-follower playlist now qualifies. No claim is made that the entire target of 1,896 playlists has been sourced or verified.

## Database migration 0030 — operator-confirmed applied

The operator ran `supabase/migrations/0030_playlist_minimum_followers_15.sql` in the Supabase SQL Editor for project `mdcvewnevgsgmyfnybgn` and reported the result:

**“Success. No rows returned.”**

This is the expected result for the migration's transactional `DO` block. The migration updates only the two follower-count guards inside `public.auto_publish_verified_opportunity_candidate(uuid)`:

- candidate follower count: reject below 15 (15 is accepted);
- corroborating evidence follower count: reject below 15 (15 is accepted).

The active-status, 0.5%–100% response-rate, individual Spotify URL, HTTPS submission route, evidence freshness and independent-corroboration guards remain unchanged. The migration raises an exception if it cannot verify the expected old/new expressions and does not delete or truncate records.

Migration source:
`supabase/migrations/0030_playlist_minimum_followers_15.sql`

Operator's copy:
`C:\\Users\\USER\\Downloads\\ArtistFrequency_Migration_0030_15_Follower_Minimum.sql`

SHA-256:
`2c78398cbee8f53e818ef918ca51b1fd746857052eda812eaaec6d189dba85d8`

## Post-migration worker verification — GitHub Actions run #78

The documentation commit triggered the hourly discovery workflow after the operator confirmed migration 0030 was applied.

- Run: #78
- Run ID: `43752249086`
- Commit: `f554b70e58ef043a809de4bcc9453dbc0d57c816`
- Trigger: push to `main`
- Result: **success**
- Configuration validation: passed
- Playlist qualification tests: passed
- Website/automation integration tests: passed
- Discovery searches: 4
- Candidates seen: 20
- Candidates queued: 0
- Records published: 0
- Records rejected: 20
- Duplicates skipped: 0
- Errors: 0

The worker log contained neither `AUTOPUBLISH_DISABLED` nor `PGRST205`, and the 15-follower rejection rule was present. This confirms the post-migration worker pass completed without the previous disabled-publication or missing-runtime-table warnings.

**No new playlist was published in run #78.** All 20 search results failed one or more evidence requirements, mainly because they were generic pages or lacked explicit activity, response-rate and independently verified HTTPS submission-route evidence. Since no candidate was queued, this run did not exercise a successful publication insert; a future qualifying candidate is still needed to verify a new row end to end.

## Preview

The protected Vercel preview is READY at:

`https://artist-frequency-preview-ev43fghdu.vercel.app/`

Deployment ID: `dpl_CWo1DZRXVzTvhA6aaQ7ppybqjBeu`

The preview returned HTTP 200 for both the homepage and served `src/app.js`; the served JavaScript contains the 15+ card and count filters. Production remains protected and was not promoted.
