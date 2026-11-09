# Artist Frequency — Vercel Deployment State

**Updated:** 9 November 2026

## Vercel project

- Team: `kingpinpkaytee-8365s-projects` (Hobby plan).
- Project: `artist-frequency`.
- Project ID: `prj_CL4dVu2ZkLZ1hwgtfDTA7ICAiQQ2`.
- Vercel SSO protection is enabled for the project.
- The source was uploaded directly to Vercel for the current preview. The project is not yet connected to the GitHub repository for automatic deployments.

## Current preview

- Deployment ID: `dpl_DDPNRuuY65AT9vnjHLtsxdHkK1za`.
- Target: preview (no production target).
- State: READY.
- Host: `artist-frequency-ppt12vqjo-kingpinpkaytee-8365s-projects.vercel.app`.
- The host is protected by Vercel access controls; a temporary share link was created for review. Do not store that expiring share token in Git.
- Read-only HTTP checks returned 200 for the site, `src/supabase-client.js`, `src/auth.js`, `src/app.js` and `supabase-config.js`.

## Production safety

An initial manual upload included `main` branch metadata and Vercel inferred a production target, despite a preview target being requested. That deployment was already READY and could not be cancelled. To avoid publishing an untested release, the project was paused immediately afterward. The default production alias `artist-frequency.vercel.app` now returns `503 DEPLOYMENT_PAUSED`.

The READY preview deployment has no production target and remains available through its protected deployment URL. Do not unpause the project or assign production traffic until hosted browser testing is complete and production release is explicitly authorised.

## GitHub automatic deployments

Vercel's Git integration could not be created because the Vercel account has no GitHub Login Connection. Vercel returned: `You need to add a Login Connection to your GitHub account first.`

To enable automatic deployments:
1. Open the Vercel dashboard and select the account avatar.
2. Open **Settings → Authentication**.
3. Under Login Connections, connect and authorise the GitHub account that owns `kingpinpkaytee-dot/global-music-submission-portal`.
4. Then link the existing `artist-frequency` Vercel project to that repository and verify the production branch.

Until this is configured, future Git pushes do not automatically update the Vercel preview or production deployment. Deployments must be uploaded manually.

## Remaining launch gates

- Complete real browser sign-up, email confirmation, sign-in, sign-out and password-reset checks over HTTPS.
- Exercise artist profile save, live credit view, verified destination selection and protected submission RPC using controlled test accounts.
- Exercise Marketplace share and admin moderation with an administrator account.
- Confirm Google OAuth settings, Site URL and redirect allowlist.
- Populate only verified, active directory records; the live directory query currently returns no records.
- Complete admin directory management, campaign review and weekly Top 5 workflows.
- Finish privacy, terms, content-rights, moderation, account deletion and retention policies.
- Obtain explicit production-release approval before unpausing or assigning the production domain.
