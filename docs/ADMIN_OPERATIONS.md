# Artist Frequency — Admin Operations

## Configured platform administrator

- Admin sign-in email: `kingpinpkaytee@gmail.com`.
- The database assigns the admin role only after Supabase confirms that email.
- Admin privileges must never be granted through user-editable profile metadata.
- Enable MFA and protect recovery methods.

## Admin responsibilities

1. Review reported content, impersonation and copyright concerns.
2. Review Marketplace submissions and approve or decline tracks through the protected `admin_review_marketplace_track` RPC.
3. Create and maintain opportunity directory listings using the protected `admin_upsert_opportunity_directory` RPC.
4. Record a public verification-evidence URL before marking a directory entry verified.
5. Publish/unpublish or deactivate directory records; do not list unverified or inactive records publicly.
6. Curate up to five eligible published Marketplace tracks for the current week's editorial Top 5.
7. Review campaign requests and confirm that proposed channels are actually integrated before describing a campaign as active.
8. Monitor abuse, fraudulent playlist offers and directory accuracy.

The current restricted admin page supports Marketplace approval/decline and directory creation/update. Directory writes use a SECURITY DEFINER RPC that requires an authenticated session and checks the database admin role. Direct browser INSERT/UPDATE/DELETE privileges on the directory table are not granted.

## Directory eligibility and delivery integrations

Migration 0015 added two directory flags:
- `is_integrated`: a working Artist Frequency delivery adapter has been deployed and verified.
- `accepts_submissions`: the destination is currently accepting new submissions through that integration.

Both flags default to false and are not editable in the browser admin form. Do not enable them until a real delivery adapter has been deployed, tested and approved through a trusted backend operation.

A directory listing may be verified and publicly visible while in-platform submissions remain locked. Artists can open its official external link, but an external submission is not an Artist Frequency submission and does not consume platform credits.

## Credit administration

- Non-admin artists receive 40 starter credits.
- Every Monday at 00:05 Africa/Johannesburg time, the scheduled reset brings each non-admin artist's ledger balance to exactly 40.
- One valid playlist, radio-station or integrated website-promotion submission costs one credit only when its directory destination is verified, public, active, integrated and accepting submissions.
- Admin submissions are unlimited, subject to destination eligibility.
- Credit entries are immutable ledger events. Never edit balances in the browser or delete ledger history.

The protected submission RPC locks the artist profile before checking and debiting credits. It validates the destination integration/acceptance flags before it inserts a submission or spends a credit. The weekly reset takes the same per-artist lock before reconciling the ledger, so a submission racing the reset cannot leave an off-by-one balance.

The production scheduler uses GMT/UTC:
- Weekly reset: Sunday 22:05 UTC = Monday 00:05 SAST.
- Marketplace publishing: every five minutes.

The weekly reset is idempotent per artist and South African calendar week. Do not manually call `run_weekly_credit_reset()` against production balances as a test. Check `cron.job` and `cron.job_run_details` read-only to inspect scheduler registration and execution history.

## Marketplace moderation

- Pending shares are private.
- Declined shares remain unpublished.
- Admin approval schedules publication 24 hours later.
- The scheduled publisher makes due tracks public and records on-site promotion events.
- Automatic promotion refers only to the Artist Frequency website; it does not imply external advertising or playlist placement.
- Weekly Top 5 is selected editorially from eligible published tracks.

## Playlist-follow verification

The playlist-follow verification flow is intentionally disabled until the official Artist Frequency Spotify playlist URL/ID and trusted verification process are configured. Never award verification based solely on a user assertion or an unchecked form field.

## Operational security

- Keep service-role keys, database passwords and OAuth client secrets server-side.
- Use MFA for administrator accounts.
- Prefer read-only queries for operational audits.
- Never run destructive migration/reset commands against production without a reviewed deployment plan.
- Do not change real balances or artist records during a permissions audit.
