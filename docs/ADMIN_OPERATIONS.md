# Artist Frequency — Admin Operations

## Configured platform administrator

- Admin sign-in email: `kingpinpkaytee@gmail.com`.
- The database assigns the admin role only after Supabase confirms that email.
- Admin privileges must never be granted through user-editable profile metadata.
- Enable MFA and protect recovery methods.

## Admin responsibilities

1. Review reported content, impersonation and copyright concerns.
2. Review Marketplace submissions and approve or decline tracks through the protected `admin_review_marketplace_track` RPC.
3. Maintain accurate, verified and permission-appropriate opportunity directories through trusted backend operations.
4. Curate up to five eligible published Marketplace tracks for the current week's editorial Top 5.
5. Review campaign requests and confirm that proposed channels are actually integrated before describing a campaign as active.
6. Monitor abuse, fraudulent playlist offers and directory accuracy.

The production website does not yet contain the complete administrative interface. Directory management, campaign review and Top 5 selection require protected admin UI/backend workflows; do not work around the absence of those tools by exposing service-role credentials to the browser.

## Credit administration

- Non-admin artists receive 40 starter credits.
- Every Monday at 00:05 Africa/Johannesburg time, the scheduled reset brings each non-admin artist's ledger balance to exactly 40.
- One valid playlist, radio-station or integrated website-promotion submission costs one credit.
- Admin submissions are unlimited.
- Credit entries are immutable ledger events. Never edit balances in the browser or delete ledger history.

The protected submission RPC locks the artist profile before checking and debiting credits. The weekly reset takes the same per-artist lock before reconciling the ledger, so a submission racing the reset cannot leave an off-by-one balance.

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
