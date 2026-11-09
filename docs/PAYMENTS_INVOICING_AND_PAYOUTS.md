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
- Provider credentials: not configured.
- Live payment and payout: disabled.

No invoice can be paid through the platform and no paid credit package can be fulfilled until the server-side checkout, webhook, verification and admin connection work is completed and tested.
