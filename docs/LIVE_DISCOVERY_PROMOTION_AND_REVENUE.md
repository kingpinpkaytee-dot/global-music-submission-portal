# Artist Frequency — Live Discovery, Promotion and Revenue Build Plan

## Current implementation boundary

The existing public opportunity directory is manually maintained. It does not yet crawl, query or synchronise playlist curators, DSPs, radio stations, podcasts or bloggers. Migration 0016 is a database foundation only; external sources remain offline until trusted discovery workers and provider credentials are configured.

## Discovery engine

The planned discovery worker runs server-side (Supabase Edge Functions or another trusted backend), with provider credentials stored only as server secrets. It should support:
- Spotify playlist discovery and authorised metadata access, plus public curator submission portals.
- Apple Music, YouTube Music, Amazon Music, Deezer, TIDAL, SoundCloud, Audiomack, Boomplay and other DSP discovery routes where public APIs, partner feeds or editorial submission routes exist.
- All genres, with artist-profile genre matching and filters for country, language, activity, free submissions and submission method.
- National and independent radio, radio programme contacts, podcasts, music blogs and press portals worldwide.
- New and recently active listings, re-check dates, official evidence URLs and duplicate detection.

A DSP is not automatically a curator-submission marketplace. Editorial playlists and algorithmic recommendation systems often have restricted access; the product must show the official artist-facing pitch route where available and label algorithmic discovery as an outcome to optimise for, not a destination that can be submitted to.

## Ranking and evidence rules

- Active/popular ranking may use source-attributed follower/listener counts and freshness.
- Approval and response rates must be based on actual recorded outcomes and a disclosed sample/window. Never infer a high approval rate from popularity or advertise an unmeasured rate.
- Curator interaction must be based on logged, consent-respecting interaction data, not a guessed score.
- New listings stay private as candidates until reviewed. A public listing requires a working official source, current evidence, and admin verification.
- Re-check listings periodically; mark stale or closed entries rather than presenting them as live.
- Respect site terms, robots rules, API limits, privacy law and email anti-spam requirements. Use publicly published business contact addresses only for relevant, lawful outreach. No bulk unsolicited email sending.

## Marketplace promotion

The existing Marketplace promotion flag controls internal Artist Frequency placement only. External paid promotion requires separate campaign consent, a budget, audience/territory/creative approval, ad-account access and platform-specific API authorisation. Integrations may include Meta Ads, Google Ads and TikTok Ads, subject to account approval and token setup. Track spend, impressions, clicks and leads separately; never promise streams or playlist placements.

## Payments and pricing

The PayPal contact supplied for the business is kingpinpkaytee@gmail.com. An email address alone is not a verified PayPal checkout URL or merchant integration. Before enabling checkout:
1. Confirm the PayPal Business account and the exact PayPal.Me or PayPal-hosted checkout link.
2. Set service prices, currency, tax treatment, delivery scope and refund/cancellation terms.
3. Create server-side orders and verify PayPal webhooks before marking an order paid or granting extra credits.
4. Keep extra-credit purchases separate from free weekly credits and preserve a complete payment/credit ledger.
5. Never place PayPal client secrets or webhook secrets in browser JavaScript.

No payment has been collected and no prices are configured by this plan.

## Required secrets and external setup

Use Supabase Edge Function secrets or an equivalent server secret store for search-provider API keys, DSP partner credentials, PayPal credentials/webhook secret, and advertising platform tokens. Do not paste secrets into GitHub, HTML, supabase-config.js, or chat.

## Release gates

- Apply migration 0016 to a non-production/test project first; review RLS and service-role access.
- Implement and test discovery provider adapters and scheduled refresh jobs.
- Build admin candidate review/merge UI and public filters with evidence/freshness labels.
- Configure PayPal products, verified checkout and webhook handling after prices and account URL are confirmed.
- Implement ad-account integrations only after artist consent and advertiser access are in place.
- Run browser and security regression before production deployment.
