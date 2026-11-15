# Supabase publication migrations — application and verification record

Date: 2026-11-15

## Operator confirmation

The project operator confirmed that the combined SQL script
`ArtistFrequency_Apply_Migrations_0028_0029.sql` completed successfully in the
Supabase SQL Editor with the message "Success. No rows returned."

The script contains migrations 0028 and 0029 in separate transactions.

## Post-application schema-cache check

A read-only request to the PostgREST relation
`public.opportunity_discovery_runtime_config` returned HTTP 401 with PostgreSQL
error `42501` ("permission denied for table opportunity_discovery_runtime_config").

This confirms the relation is present in the PostgREST schema cache while the
anonymous role is denied access by the migration's explicit privilege
revocation. Before application, the worker reported PostgREST `PGRST205`
because this relation was absent from the schema cache.

## Autonomous worker verification

GitHub Actions run #70, attempt 2, completed successfully after migration
application. The worker no longer emitted `AUTOPUBLISH_DISABLED` or
`PGRST205`, and reported:

- candidates seen: 10
- candidates queued: 0
- records published: 0
- records rejected: 10
- duplicates skipped: 0
- errors: 0

The rejected results were mainly generic Spotify landing, download, login or
app-link pages; the one partially identified playlist did not provide the
required follower count, active-status proof, response rate or independent
HTTPS submission route. No unqualified candidate was published.

## Existing directory audit and website gate

The public directory currently contains 40 active, verified public listings,
including 15 playlist records. Of those playlist records, two fail the stored
numeric eligibility rules: one has 86 followers and another has a 0% response
rate. The remaining 13 meet the stored thresholds (>100 followers and
0.5%–100% response rate); each of the 15 rows had an active status, an
individual Spotify playlist URL and an HTTPS submission URL in the audit.

The website code now applies the playlist eligibility gates before rendering
the public directory and applies the same follower, response-rate and active
status filters to the public playlist and total opportunity counts. This keeps
the two ineligible legacy records out of the public playlist totals.

Code commit: `21fcaa82f3dd128ff8ca78dceb30df7ab4551e18`

Local verification: 27 tests passed, 0 failed.

GitHub Actions run #72 completed successfully on the code commit. The worker
again reported 10 candidates seen, 0 queued, 0 published, 10 rejected and
0 errors; it emitted no migration-disable or missing-table warning.

## Preview deployment

The updated preview deployment is READY:

- URL: `https://artist-frequency-preview-iprxyi923.vercel.app/`
- Deployment ID: `dpl_8dZQk5TVjk84qXJnuWBJjvQ1ptfP`
- Source commit: `21fcaa82f3dd128ff8ca78dceb30df7ab4551e18`

The preview remains protected by Vercel SSO. Production was not unprotected or
promoted. The preview's served JavaScript was checked and contains the strict
playlist eligibility and count filters.

## Current limitation

The migration issue is resolved. The remaining discovery limitation is source
quality: the free Bing RSS search results in the last two runs did not identify
a candidate meeting every playlist gate. The existing public directory count
must not be represented as 1,896; the measured public playlist row count is 15,
with 13 passing the stored numeric filters. New placements are counted only
after the worker confirms a successful directory publication.
