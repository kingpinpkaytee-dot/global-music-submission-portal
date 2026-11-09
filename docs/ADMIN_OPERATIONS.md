# Artist Frequency — Admin Operations

## Configured platform administrator

- Admin sign-in email: `kingpinpkaytee@gmail.com`
- Admin role is assigned by the database only when the matching Supabase Auth email is confirmed.
- Admin privileges must never be granted through user-editable profile metadata.
- Enable MFA for this account in Supabase Auth and protect its recovery methods.

## Admin responsibilities

1. Review artist and profile reports.
2. Verify playlist-follow evidence for the official Artist Frequency Spotify playlist.
3. Maintain verified, active directory records for platforms, curators, playlists, radio stations, websites and bloggers.
4. Review shared marketplace tracks. Approve or decline; approved tracks publish 24 hours after approval.
5. Select up to five eligible published tracks for the current week's Marketplace Top 5.
6. Review artist campaign briefs and set achievable promotion plans.
7. Monitor abuse, copyright claims, impersonation and fraudulent playlist offers.

## Credit administration

- Artists start with 40 credits.
- Every Monday at 00:05 Africa/Johannesburg time, the scheduled reset sets a non-admin artist's balance to exactly 40.
- The reset locks each artist profile while it reconciles the ledger, serializing the reset against concurrent credit-charged submissions. A submission that waits for the reset spends from the new 40-credit balance.
- One playlist submission, radio submission or integrated website-promotion submission costs one credit.
- Admin submissions are unlimited.
- Credit changes are recorded in the ledger; do not edit balances in the browser.

## Marketplace moderation

- Pending shares are private.
- Declined shares remain unpublished.
- Approved shares are scheduled for publication 24 hours after approval.
- The scheduled publisher makes due tracks public and adds them to the site's promoted marketplace feed.
- External advertising or social promotion is not implied by on-site auto-promotion.

## Important

The admin email and workflows are defined in repository source. Actual sign-in, admin access, scheduled tasks and review screens are not live until Supabase is provisioned, migrations are applied and server-side operations are deployed.
