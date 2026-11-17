# Production reconciliation and Premium sandbox readiness

Date: 2026-11-17
Project: Artist Frequency / Global Music Submission Portal
Supabase project: mdcvewnevgsgmyfnybgn
Cloudflare Pages project: global-music-submission-portal

## Production migration reconciliation

The production migration ledger initially contained versions 0001-0022 and 0031, while local source files contained 0001-0030. The production-only 0031 migration was recovered with the Supabase migration fetch command and retained as the exact production migration source.

A read-only production schema inspection showed that migrations 0023-0027 had not been fully applied, despite later migration work being recorded. The missing migrations were applied sequentially from source:

- 0023 — submission destination/type expansion
- 0024 — public web-search opportunity candidates
- 0025 — administrator review and individual publication
- 0026 — bulk candidate publication function
- 0027 — explicit disabling of bulk publication

Before applying 0024, the historical seed query was amended to exclude PlaylistDock candidates because PlaylistDock's published terms prohibit automated collection. The seed remains idempotent and no PlaylistDock seed rows were added.

The operator's 15 November records confirm manual SQL Editor application of 0028, 0029 and 0030. After confirming the resulting schema and function definitions, the production migration ledger was repaired to record 0023-0030 as applied. A subsequent migration-list check showed local and remote migration versions 0001-0031 aligned.

## Production post-migration verification

A read-only SQL verification confirmed:

- `hourly_opportunity_discovery_runs.candidates_queued` exists.
- The administrator's individual candidate-review RPC exists.
- The bulk-publication RPC exists but its function body explicitly raises an error that bulk publication is disabled.
- Submission type constraints and the submission RPC support curator, platform and contact destinations.
- The public web-search candidate seed contains 22 records.
- PlaylistDock seed count is zero.
- The opportunity discovery runtime configuration contains one row.
- Migration 0031's Premium subscription table and service-role settlement RPC exist.

No migration above 0031 was created or applied. No broad `supabase db push` was used.

## Website and Premium sandbox source

The Acer working tree was fast-forwarded to GitHub main commit `86979b88fd3ac6998615c550332caa9752553375`. The pre-sync local homepage edit and backup files were copied to `C:\\Users\\USER\\portal-safety-backups\\2026-11-17`; the homepage edit was stashed instead of discarded.

Premium subscription Edge Function sources were restored selectively from the Paystack sandbox implementation branch without merging its stale website files over the newer main branch. The main branch now retains its current Google/Spotify auth, single-tab navigation and submission gating while exposing a clearly labelled Test Mode-only Premium checkout UI.

The local Premium handlers are fixed to R99 ZAR monthly and use a Paystack Test Mode secret only. No live Premium bypass flag is present. The subscription settlement RPC is service-role-only and grants 10 credits once per unique verified monthly payment reference. The browser return URL does not grant access.

## Paystack secret configuration observation

A names-only inventory of Supabase Edge Function secrets showed a misspelled Premium Test key name, `PAYSTACK_PREMIUM_TEST_SECRETE_KEY`. The code accepts the correct `PAYSTACK_PREMIUM_TEST_SECRET_KEY` first and the existing misspelled name as a compatibility fallback. The secret value was not retrieved, printed or changed. The Premium handlers still reject any value that does not begin with `sk_test_`.

The inventory did not show `PAYSTACK_TEST_WEBHOOK_SECRET` or `PAYSTACK_WEBHOOK_SECRET`. The webhook source supports Paystack's newer timestamped `Paystack-Signature` header when the environment's `whsec_` signing secret is configured, and retains legacy `x-paystack-signature` verification with the environment's API secret. Do not remove or rotate the API secrets while legacy signatures are still in use. Obtain and configure the environment-specific webhook signing secrets before relying on the newer signature mode.

The existing invoice key `PAYSTACK_SECRET_KEY` remains separate from the Premium test key. No secret value was exposed or modified.

## Local verification

On 17 November 2026:

- `node --test scripts\\*.test.mjs`: 33 passed, 0 failed.
- Tests cover internal same-tab navigation, Google/Spotify sign-in, submission auth gating, PlaylistDock seed exclusion, 15-follower playlist thresholds, individual-only opportunity review, Premium Test Mode guards, webhook signature configuration and subscription-credit settlement restrictions.

## Deployment and HTTP verification

The tested source was committed and pushed to GitHub `main`:

- Commit: `ed95b986645ccd81936aa598e0513e19a0870940`
- Message: `Reconcile production migrations and restore Premium sandbox flow`
- GitHub Actions run `44056229386`: completed successfully. Its configuration, qualification, website integration test and discovery steps passed.

The five Supabase Edge Functions were redeployed successfully on 17 November 2026. A fresh function inventory confirmed all five are ACTIVE:

| Function | Version | Updated (UTC) |
|---|---:|---|
| create-paystack-checkout | 10 | 09:34:04 |
| payment-admin-status | 10 | 09:35:01 |
| create-premium-subscription | 8 | 09:35:54 |
| cancel-premium-subscription | 8 | 09:37:44 |
| paystack-webhook | 10 | 09:40:04 |

Cloudflare Pages production deployment completed successfully:

- Deployment ID: `79510df7-cee8-4f75-8644-c63f44d37797`
- Deployment URL: `https://79510df7.global-music-submission-portal.pages.dev`
- Branch: `main`
- Source commit: `ed95b98`
- Wrangler uploaded 6 files; 2 were already present.

HTTP checks returned 200 for the homepage, app module, auth module, Supabase client, public Supabase config, robots.txt, sitemap.xml and Google Search Console verification file on both the immutable deployment URL and the production `global-music-submission-portal.pages.dev` alias. The served homepage contains the Premium Test Mode panel and Google/Spotify sign-in controls; served JavaScript contains the Premium subscription handlers and both OAuth providers.

CORS preflight requests from the production Pages origin returned 200 for the four browser-invoked functions: `create-paystack-checkout`, `payment-admin-status`, `create-premium-subscription` and `cancel-premium-subscription`. The Paystack webhook is a server-to-server POST endpoint, so the browser-style OPTIONS probe returned 405 as expected. An unsigned webhook POST returned 401 `Invalid signature`. Unauthenticated POSTs to all four browser-invoked functions returned 401 `Missing authorization header`. No payment or mutation was made by these probes.

## Remaining acceptance items

The selected production hostname is `https://global-music-submission-portal.pages.dev`. The former `.org` hostname is retired by owner decision and must not be used in canonical tags, payment origins, OAuth redirects, callback URLs or sitemap/robots metadata. Keep `APP_ORIGIN`, `CORS_ALLOWED_ORIGINS` and `PAYMENT_RETURN_URL` aligned with the selected Pages hostname; the browser-facing Edge Functions now reject origins outside the active Pages host and the explicitly allowed protected preview host.

Premium acceptance testing is not complete. The administrator must:

1. Open Payment Centre and select **Check Paystack connection** to confirm that the R99 ZAR/month Test Mode plan is ready.
2. Register/confirm the Paystack Test Mode webhook endpoint:
   `https://mdcvewnevgsgmyfnybgn.supabase.co/functions/v1/paystack-webhook`.
3. Configure the environment-specific `whsec_` webhook signing secret when available. The current handler retains legacy API-key HMAC support; no webhook signing-secret value has been exposed or changed.
4. Complete a Test Mode subscription payment and confirm the verified webhook activates membership and grants 10 credits exactly once.
5. Test duplicate webhook delivery, failed payment, renewal, cancellation and retention through the paid-through date.

Live Premium billing remains locked. No real customer charge, live transaction or bank payout has been made or enabled.
