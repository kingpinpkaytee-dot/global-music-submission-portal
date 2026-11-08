# Phase 4 — Supabase connection and authentication

This phase prepares the static site to connect to Supabase Auth. It does not create a Supabase project or activate a production backend by itself.

## 1. Create the Supabase project

1. Sign in to the Supabase dashboard and create a project for Artist Frequency.
2. Choose a strong database password and store it in a password manager.
3. Wait until the database is provisioned.
4. Open **Project Settings → API** (or the project's API keys page).
5. Copy only the **Project URL** and the **publishable key** (or legacy anon/public key).

Never copy the `service_role` / secret key into the website, GitHub, chat, or any browser-visible file.

## 2. Configure the website

Edit `supabase-config.js` in the repository:
- Replace `https://YOUR-PROJECT.supabase.co` with the Project URL.
- Replace `YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY` with the publishable/anon key.

These are public client values. Do not put private keys in this file. Commit only after confirming that no service-role or database password is present.

The site loads Supabase JS v2 from jsDelivr in `src/auth.js`. The sign-up, password sign-in and Google OAuth buttons use Supabase Auth. Email confirmation is expected when enabled in project settings.

## 3. Configure Auth URLs

In **Authentication → URL Configuration**:
- Set the Site URL to the actual hosted website origin.
- Add the local development origin to Redirect URLs if local testing is required.
- Add the production origin and any preview origin that will be used for OAuth callbacks.

Do not use a wildcard redirect in production unless there is a specific, reviewed need.

## 4. Apply database migrations

Use the Supabase SQL Editor or Supabase CLI and apply migrations in numeric order:
1. `supabase/migrations/0001_core_platform.sql`
2. `supabase/migrations/0002_artist_frequency_features.sql`
3. `supabase/migrations/0003_signup_and_public_stats_hardening.sql`
4. `supabase/migrations/0004_submission_credits_and_verification.sql`
5. `supabase/migrations/0005_campaign_and_admin_policy_fixes.sql`

Apply first to a non-production project. Review SQL errors and inspect resulting tables, views, functions, triggers and RLS policies before using real artist data. Do not treat a committed migration as an applied migration.

## 5. Enable Google OAuth

1. Create a Google OAuth client in Google Cloud Console.
2. Configure the authorised redirect URI shown by the Supabase Google provider setup screen (the Supabase Auth callback URL).
3. In Supabase **Authentication → Providers → Google**, enable Google and enter the OAuth client ID and secret directly in the dashboard.
4. Save and test the callback using the configured site redirect URL.

Keep the Google client secret in Supabase provider settings; never add it to GitHub or frontend JavaScript.

## 6. Security and launch gates

Before public launch:
- Test sign-up, email confirmation, sign-in, sign-out, password recovery and Google OAuth.
- Test RLS with two different artist accounts and an unauthenticated browser.
- Confirm the verified admin email receives admin role only through the database trigger.
- Confirm artists cannot change role, verification status, credit ledger entries or moderation decisions.
- Configure abuse protection, rate limits, CAPTCHA where appropriate, backups, privacy/deletion workflows, Terms and content-rights policies.
- Schedule the Monday 00:05 Africa/Johannesburg credit reset only after the migrations have been successfully applied and validated.
- Configure the 24-hour Marketplace publisher only after moderation and scheduling have been tested.

## Current boundary

The repository now contains the browser Auth integration scaffold and this setup runbook. Until a Supabase project URL/key are supplied and configured, the page deliberately reports that Auth is not configured. Database migrations remain unapplied, so submissions, credits, public counters, campaigns and Marketplace workflows are not live.
