# Phase 4 — Supabase connection, migrations and authentication

This runbook is for a **new Supabase environment** or a controlled rebuild. The existing Artist Frequency production project is already linked and migrations 0001–0013 are applied. Do not reapply migrations or create a second production project just to follow this guide.

## 1. Create or select a Supabase project

1. Create a dedicated project for the intended environment.
2. Store its database password in a password manager.
3. Wait until database provisioning completes.
4. Open the project API settings and copy the Project URL and publishable key (or legacy anon/public key).

Never place a service-role/secret key, database password or OAuth client secret in the browser, GitHub, chat, or `supabase-config.js`.

## 2. Configure the browser client

The browser config is `supabase-config.js`. It contains only the public Project URL and publishable key. For a separate staging project, use its own environment-specific values and avoid accidentally replacing production configuration.

The site loads Supabase JS v2 from jsDelivr. `src/auth.js` contains email/password registration and sign-in plus the Google OAuth client flow. Provider availability is controlled by Supabase Auth settings.

## 3. Link the Supabase CLI

From the repository root, authenticate and link the intended project:

```powershell
npx --yes supabase@latest login
npx --yes supabase@latest link --project-ref YOUR_PROJECT_REF
```

Never paste access tokens, database passwords or privileged keys into source files or commit them.

## 4. Review and apply migrations

For a new environment, apply every migration in ascending numeric order:

1. `0001_core_platform.sql`
2. `0002_artist_frequency_features.sql`
3. `0003_signup_and_public_stats_hardening.sql`
4. `0004_submission_credits_and_verification.sql`
5. `0005_campaign_and_admin_policy_fixes.sql`
6. `0006_security_and_credit_hardening.sql`
7. `0007_restrict_trigger_function_execution.sql`
8. `0008_install_scheduler_jobs.sql`
9. `0009_least_privilege_artist_finance.sql`
10. `0010_least_privilege_view_grants.sql`
11. `0011_harden_default_privileges.sql`
12. `0012_serialize_weekly_credit_reset.sql`
13. `0013_restrict_updated_at_trigger_execution.sql`

Review the pending migration list before any deployment:

```powershell
npx --yes supabase@latest db push --dry-run --remote
```

Only apply migrations after confirming the linked project is the intended environment:

```powershell
npx --yes supabase@latest db push --remote --yes
```

For the existing production project, the expected dry-run result is no unapplied migrations. Do not run destructive reset commands against production.

## 5. Configure Supabase Auth

In Supabase Authentication settings:
- Enable email/password and configure email confirmation and password recovery.
- Set the exact production Site URL.
- Add only the necessary production and local development redirect URLs.
- Enable Google only after creating a Google OAuth client and entering its client ID/secret directly in Supabase provider settings.
- Use the exact callback URL Supabase displays for the Google provider. Do not use broad wildcard redirects in production.

## 6. Protect the administrator

The configured administrator role is assigned by a database trigger only after Supabase confirms the matching Auth email. A user cannot grant themselves admin access through profile metadata or the browser.

Enable MFA for the administrator and protect recovery methods. Never place administrator credentials or privileged server keys in frontend code.

## 7. Verify production configuration

Use read-only SQL checks to confirm:
- 11 public tables have RLS enabled.
- The expected RLS policies are present.
- Anonymous access is limited to intended public read-only surfaces.
- Artists can access only their own private records, subject to the RLS policies.
- The weekly reset function is executable by the trusted scheduler role but not anon/authenticated.
- The weekly reset cron job is active at Sunday 22:05 UTC (Monday 00:05 SAST).
- The Marketplace publisher job is active every five minutes.
- Public statistics and Marketplace views expose only intended public information.

Do not manually run `run_weekly_credit_reset()` on production as a test. It changes real artist balances. Verify scheduler registration and function permissions without invoking the routine.

## 8. Pre-launch security and product gates

- Test sign-up, email confirmation, sign-in, sign-out, password recovery and configured OAuth callbacks.
- Test RLS with separate anonymous, artist A, artist B and admin sessions.
- Confirm artists cannot edit privileged profile fields, other artists' records, credit entries or moderation decisions.
- Verify the protected submission RPC rejects inactive/unverified destinations and insufficient balances.
- Configure abuse controls, rate limits, CAPTCHA as appropriate, backups, account deletion and data retention.
- Configure the official Artist Frequency Spotify playlist and trusted verification process before enabling playlist-follow verification.
- Populate opportunity directories only with verified, active and permission-appropriate entries.
- Publish privacy, terms, content-rights and moderation policies.

## Current boundary

The Supabase production schema, least-privilege grants, RLS policies, credit submission RPC, weekly reset routine, Marketplace publisher and cron registrations are deployed. The public website is still a frontend preview; account workflows, artist dashboards, submissions, campaigns, Marketplace and administrative tools must be wired to the backend and validated before a public launch.
