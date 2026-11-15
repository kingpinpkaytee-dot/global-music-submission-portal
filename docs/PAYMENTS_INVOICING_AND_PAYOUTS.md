# Artist Frequency — Payment, invoicing and payout architecture

## Provider decision

Primary integration candidate: **Paystack South Africa**. It supports hosted online checkout, South African registered-business transfers and transaction splits/subaccounts. Transfers and manual payouts are eligibility-gated; Paystack must approve the merchant and the required product capabilities before the platform enables them.

Secondary provider candidate: **Peach Payments**. Its South African Payouts API can pay suppliers, partners or customers after account verification and prefunding. Payouts are separate from checkout and failed/irreversible transfer conditions must be handled explicitly.

Yoco is a possible simpler collection/settlement fallback, but it is not the initial marketplace payout design.

Provider references:
- Paystack South Africa availability: https://support.paystack.com/en/articles/2130562
- Paystack transaction splits: https://support.paystack.com/en/articles/2132802
- Paystack transfers: https://paystack.com/docs/transfers/
- Paystack manual payouts eligibility: https://support.paystack.com/en/articles/2131074
- Peach Payments payouts: https://developer.peachpayments.com/docs/peach-payouts
- Yoco payout information: https://support.yoco.help/en/articles/109595-yoco-payouts

## Financial separation

1. Artist checkout pays Artist Frequency for an invoice or membership.
2. Provider settles funds to the verified business payout account linked in the provider's merchant dashboard.
3. Artist/vendor disbursements are a separate, admin-authorised payout workflow. Do not represent a payment to Artist Frequency as money automatically owed to an artist.
4. Marketplace revenue shares or artist earnings require written terms, KYC/beneficiary onboarding, provider approval and a separate payout ledger before launch.

## Admin connection workflow

- Admin creates/owns a verified South African business merchant account with the chosen provider.
- Admin links the settlement bank account inside that provider's official dashboard and completes KYC.
- Admin provisions live/test API keys and webhook secrets in Supabase Edge Function secrets (or an approved secrets vault); never in the browser, Git, SQL tables, public config or ordinary admin form fields.
- The platform stores only provider name, test/live mode, non-sensitive account label/reference, verified capability flags and last verification state.
- A provider is not shown as connected until a server-side credential check and webhook verification succeed.
- Admin can open the official provider dashboard from the Admin workspace. The dashboard link is a shortcut, not proof of a connection.

## Required payment lifecycle

- Admin issues a ZAR invoice with immutable line-item snapshots, due date and explicit tax treatment.
- Artist sees only their own invoices and opens a provider-hosted checkout session.
- Server calculates amount from invoice rows; never trust browser-supplied amount, credits, artist ID or status.
- Create a unique provider reference and persist an initiated payment attempt before returning the hosted checkout URL.
- Webhook signature is validated using the raw request body and provider secret. Deduplicate event IDs/references.
- Verify transaction status/amount/currency with the provider API before marking paid.
- In one database transaction: mark payment succeeded, mark invoice paid, and grant any purchased credits exactly once. Failed/cancelled/duplicate webhooks never issue credits.
- Browser return/callback is informational only; it must not mark an invoice paid.

## Payout safety

- Provider settlement to the platform's own verified bank account is configured in the provider dashboard, not by collecting bank details from artists.
- For future artist/vendor payouts, store only provider recipient tokens/references, not raw bank account numbers.
- Require admin role, step-up confirmation, beneficiary verification, sufficient available balance, idempotency key, amount limits and audit trail.
- A payout request must be checked against provider status; never label a queued transfer as paid.
- Paystack Transfers in South Africa are restricted to registered businesses. Manual payout settlement has additional eligibility and history requirements.
- Peach payout requests require prefunding and verified beneficiary accounts; submitted successful payouts may not be recallable and refunds are not supported by the payout API.
- Do not launch artist earnings or split payments until contracts, KYC, accounting, tax and provider approval are complete.

## Database foundation

Migration `0017_payment_invoicing_and_payout_foundation.sql` adds:
- artist-owned invoices and immutable line items
- provider connection metadata (no credentials)
- payment attempts and deduplicated webhook event records
- admin-visible payout transaction audit records
- an admin-only invoice creation RPC
- a one-time purchase-credit ledger entry type with uniqueness protection

The migration is **not applied to production**. Review and apply it only through the normal migration approval process.

## Current implementation status

- Provider selection: Paystack recommended, Peach secondary.
- Database migration: drafted locally.
- Hosted checkout Edge Functions: not yet implemented.
- Webhook verification and credit fulfilment: not yet implemented.
- Admin provider-link UI and connection health check: not yet implemented.
- Artist invoice list/checkout UI: not yet implemented.
- Provider credentials: existing Supabase secrets inventory needs correction; use the exact environment variable names above. A secret entry whose name resembles a key prefix is not a correctly named environment variable.
- Live payment and payout: disabled.

No invoice can be paid through the platform and no paid credit package can be fulfilled until the server-side checkout, webhook, verification and admin connection work is completed and tested.


## Server-side functions added in the next implementation phase

- `create-paystack-checkout`: authenticated artist only; looks up the invoice by the signed-in artist ID; calculates the amount from the stored invoice; creates a payment attempt; asks Paystack for hosted checkout; returns only the hosted URL.
- `paystack-webhook`: JWT verification is disabled only for this provider callback; validates the raw-body `x-paystack-signature` HMAC-SHA512; deduplicates provider events; verifies the transaction directly with Paystack; checks amount and ZAR currency; invokes the atomic settlement RPC.
- `payment-admin-status`: verifies the signed-in user and calls the existing `is_site_admin` RPC using that user's JWT; checks the server-side Paystack key with the provider; never returns the key.
- Migration `0018_verified_payment_settlement.sql`: service-role-only settlement RPC; issues purchased credits once using the unique purchase-grant ledger index; adds an admin-only artist list RPC for invoice creation.

## Required deployment sequence

1. Review and apply migrations 0017 and 0018 to Supabase production through the approved migration process.
2. Add these secrets in Supabase Project → Edge Functions → Secrets:
   - `PAYSTACK_SECRET_KEY` — reserved for the existing invoice-payment provider key; do not change it to test Premium.
   - `PAYSTACK_PREMIUM_TEST_SECRET_KEY` — separate Paystack Test Mode `sk_test_` key for the R99/month Premium sandbox.
   - `PAYSTACK_WEBHOOK_SECRET` — existing/live webhook signing secret (`whsec_`).
   - `PAYSTACK_TEST_WEBHOOK_SECRET` — Test Mode webhook signing secret (`whsec_`).
   - `APP_ORIGIN` (the exact deployed site origin, e.g. `https://artist-frequency.vercel.app`)
   - `CORS_ALLOWED_ORIGINS` (comma-separated exact origins allowed to call browser-facing functions; include only the active production/preview origins)
   - `PAYMENT_RETURN_URL` (an HTTPS URL on the site, e.g. `https://artist-frequency.vercel.app/?view=billing&payment=return`)
   Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Never copy the service-role key into frontend configuration.
3. Deploy the three functions:
   - `npx --yes supabase@latest functions deploy create-paystack-checkout --project-ref mdcvewnevgsgmyfnybgn`
   - `npx --yes supabase@latest functions deploy payment-admin-status --project-ref mdcvewnevgsgmyfnybgn`
   - `npx --yes supabase@latest functions deploy paystack-webhook --project-ref mdcvewnevgsgmyfnybgn`
4. Configure the webhook URL in the Paystack dashboard as:
   `https://mdcvewnevgsgmyfnybgn.supabase.co/functions/v1/paystack-webhook`
5. Test with Paystack test keys and test transactions. Confirm webhook delivery, invoice paid state, one-time ledger grant, duplicate webhook handling, failed checkout and amount/currency mismatch.
6. Keep the invoice key and Premium Test key separate. Do not enable live Premium billing or replace the existing invoice key as part of sandbox QA. Keep payouts disabled until Paystack confirms the merchant's South African transfer capability and bank beneficiary checks.

## Current limits

- The UI now includes an artist invoice workspace and a restricted admin Payment Centre / custom invoice form.
- Payouts to artists, suppliers or third parties are intentionally not enabled. The provider's own settlement bank account is linked in the provider's official dashboard. Any later artist/vendor payout system requires separate approval, beneficiary verification, sufficient balance controls, audit logs and legal/accounting terms.
- Invoice prices are manually entered by the administrator. The previously proposed service tariff is not activated or assumed approved.
- Tax is zero by default. VAT must not be charged or described as applicable unless the business's VAT registration and tax obligations have been confirmed.
- These functions and UI are source code only until migrations, secrets, function deployments, webhook registration and end-to-end sandbox testing are completed.


## Recurring Premium membership — sandbox implementation

The recurring Premium membership is implemented as a separate Paystack subscription product; it does not reuse the one-time invoice-payment flow.

- Product: Artist Frequency Premium, **ZAR 99.00 monthly** (9,900 cents).
- Payment method: Paystack recurring bank-card authorization. Bank EFT / Capitec Pay are one-off methods and are not used for recurring membership.
- Paystack plan: the administrator's Payment Centre checks the merchant key and provisions/reuses the matching monthly ZAR 9,900 plan in **Test Mode**. The resulting plan code is stored in the non-secret `payment_provider_accounts.capabilities` metadata.
- Artist flow: authenticated user → server creates a pending subscription row → server initializes Paystack transaction with the plan code → browser is redirected to Paystack-hosted checkout.
- Entitlement: browser return URL never activates Premium. The webhook validates Paystack HMAC-SHA512, verifies the transaction directly with Paystack, confirms ZAR 9,900, and calls the service-role-only settlement RPC before the membership is marked active.
- Management: the artist can request cancellation using the stored Paystack subscription code and private email token. The token remains server-only. Cancellation stops future renewal but preserves access through the paid period.
- Renewal events: process `invoice.update`, `invoice.payment_failed`, `subscription.not_renew`, `subscription.disable`, and `charge.success`. Duplicate webhook events are idempotently recorded in `payment_webhook_events`.
- Payment failure: the membership moves to `attention`; it is not renewed or granted extra paid time unless Paystack later verifies a successful renewal. Access already paid for remains available until `paid_through_at`.
- Environment guard: `create-premium-subscription` only accepts `sk_test_` by default. A live key is rejected unless the separate `PAYSTACK_ALLOW_LIVE_PREMIUM=true` flag is intentionally provisioned after formal launch approval. Do not add that flag during sandbox testing.

### Recurring membership migration and Edge Functions

Migration `0031_artist_premium_subscriptions.sql` creates the subscription ledger, restricts browser access to non-sensitive membership columns, and exposes a settlement RPC only to `service_role`.

Additional functions:

- `create-premium-subscription` — authenticated artist, fixed plan/amount, no browser-supplied amount or plan code.
- `cancel-premium-subscription` — authenticated owner only; Paystack email token is never returned.
- `payment-admin-status` — preserves the existing invoice/live key as `PAYSTACK_SECRET_KEY`, validates the separate `PAYSTACK_PREMIUM_TEST_SECRET_KEY`, and prepares/reuses the Test Mode R99 ZAR monthly plan.
- `paystack-webhook` — HMAC-SHA512 provider callback; configured with `verify_jwt=false` because Paystack signs its callbacks using `x-paystack-signature`, not a Supabase user JWT.

The invoice checkout and Premium sandbox use separate Paystack API credentials. `PAYSTACK_SECRET_KEY` must not be replaced while testing Premium. The CORS allow-list contains the exact production website origins, the Artist Frequency Vercel preview hostname pattern, and any additional exact origins supplied through `CORS_ALLOWED_ORIGINS`. The Edge Functions still authenticate all artist/admin requests with Supabase user JWTs.

### Sandbox deployment sequence

1. Confirm migrations 0017 and 0018 are applied, then apply migration 0031 after migration 0030.
2. Keep `PAYSTACK_SECRET_KEY` unchanged for the existing invoice-payment flow (normally the live merchant key). Add a separate `PAYSTACK_PREMIUM_TEST_SECRET_KEY` with a Paystack Test Mode `sk_test_` value. Never overwrite the invoice key to test Premium. Add `PAYSTACK_TEST_WEBHOOK_SECRET` with the Test Mode webhook signing secret (`whsec_`). Keep `PAYSTACK_WEBHOOK_SECRET` reserved for the existing live webhook signing secret. Do not send or commit any secret values. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase.
3. Deploy `payment-admin-status`, `create-premium-subscription`, `cancel-premium-subscription`, `create-paystack-checkout`, and `paystack-webhook`. Deploy the webhook without JWT verification (the repository config now sets `verify_jwt = false`).
4. Sign in as the platform administrator on the preview deployment and select **Check Paystack connection**. Confirm the status says connected, TEST, and Premium plan ready.
5. Register this webhook URL in the Paystack Test Mode dashboard:
   `https://mdcvewnevgsgmyfnybgn.supabase.co/functions/v1/paystack-webhook`
6. Run a successful test-card checkout, then confirm the subscription row becomes active only after a verified webhook. Also test failed charge, duplicate webhook, cancellation, renewal success and renewal failure.
7. Keep production checkout locked. Do not use a live key or set `PAYSTACK_ALLOW_LIVE_PREMIUM=true` until all sandbox cases and merchant setup have passed.

### Test acceptance criteria

- An unsigned browser cannot create, view or cancel another artist's membership.
- An artist can read only non-sensitive status columns for their own subscription.
- The server ignores client-supplied plan/amount and always uses the stored R99 ZAR monthly plan.
- A return URL alone never activates access.
- Invalid signatures, unknown references, wrong amounts, wrong currency and duplicate events never create or extend a membership.
- Cancellation preserves paid access to the recorded end date and prevents renewal.
- Live card billing remains disabled during the preview testing phase.


## Recurring Premium membership — sandbox implementation

The recurring Premium membership is a separate Paystack subscription product. It does not reuse the one-time invoice checkout.

- Product: Artist Frequency Premium — **ZAR 99.00 monthly** (9,900 cents).
- Payment method: recurring bank-card authorization. Paystack subscriptions support cards; Direct Debit is only available in Nigeria. EFT and Capitec Pay are not recurring membership methods. See the Paystack Subscriptions documentation.
- The administrator's Payment Centre verifies the merchant API key and creates/reuses the R99 monthly ZAR Test Mode plan. Its non-secret plan code is stored in `payment_provider_accounts.capabilities`.
- Artist flow: authenticated user → pending local subscription row → Paystack hosted checkout initialized with the stored plan → secure hosted card authorization.
- Entitlement: a browser return URL never activates Premium. The webhook verifies Paystack's signature, verifies transaction status/reference/amount/currency with Paystack, then calls the service-role-only settlement RPC.
- Each distinct successful monthly payment grants **10 Premium credits exactly once**, using a provider-payment-reference idempotency table and the existing `purchase_grant` credit ledger entry type.
- Cancellation uses the server-only Paystack subscription code and email token. The token is never selected to the browser. Renewal is stopped while access remains available through the paid period.
- Renewal processing supports `invoice.update`, `invoice.payment_failed`, `subscription.not_renew`, `subscription.disable` and `charge.success`. Unprocessed event types (including Paystack endpoint ping) are acknowledged without granting access.
- Environment guard: `create-premium-subscription` only accepts `sk_test_` by default. Live keys are rejected unless `PAYSTACK_ALLOW_LIVE_PREMIUM=true` is deliberately enabled after formal release approval.

### Webhook signature configuration

Paystack's current signing format uses the `Paystack-Signature` header and a webhook signing secret beginning `whsec_`. The webhook verifies the Test Mode signature with `PAYSTACK_TEST_WEBHOOK_SECRET` and the Live invoice signature with `PAYSTACK_WEBHOOK_SECRET`. It validates HMAC-SHA512 over `timestamp + "." + raw request body`, rejects timestamps outside 300 seconds, and compares the hex signature in constant time. Legacy `x-paystack-signature` verification checks the matching environment API key (`PAYSTACK_PREMIUM_TEST_SECRET_KEY` for Test, `PAYSTACK_SECRET_KEY` for Live). The matched API key is then used to verify the transaction with Paystack. Do not store either secret in Git or browser JavaScript.

### Recurring membership migration and Edge Functions

Migration `0031_artist_premium_subscriptions.sql` creates the membership table, keeps the Paystack email token server-only, adds the unique monthly credit-grant ledger and exposes the settlement RPC only to `service_role`.

Additional functions:

- `create-premium-subscription` — authenticated artist only; fixed R99 plan, no browser-supplied amount or plan code.
- `cancel-premium-subscription` — authenticated owner only; email token remains server-side.
- `payment-admin-status` — verifies Paystack credentials and prepares/reuses the R99 ZAR monthly Test Mode plan.
- `paystack-webhook` — HMAC signature verification (current `Paystack-Signature` and legacy `x-paystack-signature`); Supabase JWT verification is disabled only for this provider callback.

### Sandbox deployment sequence

1. Confirm migrations 0017 and 0018 are applied, then apply migration 0031 after migration 0030. Do not run a broad database push until the remote migration history is checked.
2. In Supabase Edge Function Secrets set `PAYSTACK_SECRET_KEY` to the Paystack **Test Mode** secret and `PAYSTACK_WEBHOOK_SECRET` to the current `whsec_` webhook signing secret. Never send either value through chat or commit them.
3. Supabase injects `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. The website origins are allow-listed in the payment functions; `CORS_ALLOWED_ORIGINS` can be used for additional exact origins.
4. Deploy `payment-admin-status`, `create-premium-subscription`, `cancel-premium-subscription`, `create-paystack-checkout` and `paystack-webhook`. The Supabase config sets `verify_jwt=false` only for the Paystack webhook.
5. Sign in as the platform administrator on the feature preview and use **Check Paystack connection**. Confirm `connected`, `TEST` and `premium_plan_ready=true`.
6. Register webhook URL `https://mdcvewnevgsgmyfnybgn.supabase.co/functions/v1/paystack-webhook` in Paystack Test Mode and enable the recurring charge/subscription events.
7. Complete a test card checkout. Confirm subscription status changes only after a verified webhook and exactly 10 credits are granted. Test duplicate webhook, failed charge, cancellation, renewal success and renewal failure.
8. Keep live billing locked. Do not set `PAYSTACK_ALLOW_LIVE_PREMIUM=true` or deploy live keys until all sandbox tests and merchant setup are formally approved.

### Sandbox acceptance criteria

- Unauthenticated browser cannot create or cancel a membership.
- Each artist can read only non-sensitive membership columns for their own account.
- Browser cannot choose the plan price, plan code, currency, artist ID or status.
- Browser return alone never grants Premium.
- Wrong amount, currency, event signature, old timestamp, unknown reference and duplicate payment never activate or extend membership.
- Exactly 10 credits are granted once per distinct successful monthly payment.
- Cancellation preserves the existing paid-through date and disables future renewal.
- Live card billing remains locked during the preview phase.
