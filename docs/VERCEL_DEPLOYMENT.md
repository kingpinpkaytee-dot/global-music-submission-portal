# Artist Frequency — Vercel Auxiliary Project State

**Updated:** 9 November 2026 (historical Vercel project record; production-host correction added 19 November 2026)

> **Current production host:** Artist Frequency's selected public production site is Cloudflare Pages at `https://global-music-submission-portal.pages.dev/` (Pages project `global-music-submission-portal`). This document records the separate Vercel projects only. Do not use a Vercel project URL as the public production canonical host. The latest Cloudflare Production deployment is `3bb98c90-02e5-4533-aea7-67c75ccb0a68` (main source `935db5b`); the Pages project currently has no Git provider connection and uses Wrangler direct uploads.

## Vercel team

- Team: `kingpinpkaytee-8365s-projects` (Hobby plan).
- Canonical project: `artist-frequency`.
- Canonical project ID: `prj_CL4dVu2ZkLZ1hwgtfDTA7ICAiQQ2`.
- The Vercel project remains paused for new production releases. It is separate from the selected Cloudflare Pages production host; do not unpause it or route public traffic to it as part of routine verification.

## Current isolated preview project

The canonical project was paused after an upload was incorrectly inferred as a production deployment. A fresh, separate Vercel project was created so the updated source could be previewed without unpausing the canonical project.

- Project: `artist-frequency-preview`.
- Project ID: `prj_3kGRczydXhC2ZgoWV5uQbTjDckZ9`.
- Latest source commit: `2e72b73bb6f61e985bbec99ed94bb3874e129f78` — dedicated Dashboard workspace windows.
- Latest deployment ID: `dpl_F2WfnCRdispgssA2KCKR4jUNZPGY`.
- Latest deployment URL: `https://artist-frequency-preview-rklwh91n4.vercel.app`.
- State: READY.
- Vercel deployment target reported by the API: `null` (the deployment was created without a production/staging target and has no assigned aliases).
- SSO protection is enabled for all deployments in the preview project.
- A time-limited share link was created for review. Do not store the share token in Git; Vercel reported expiry on 10 November 2026.

Read-only HTTP checks returned status 200 for:
- The page root (`/`).
- All nine Dashboard query routes: `?view=dashboard`, `submissions`, `discover`, `marketplace`, `campaigns`, `profile`, `account`, `stats` and `admin`.
- `/src/supabase-client.js`
- `/src/auth.js`
- `/src/app.js`
- `/supabase-config.js`

The Dashboard now acts as a workspace launcher. Each selection opens a dedicated browser tab and focused section; the administrator tile is revealed only after the signed-in profile confirms the admin role. Static route/link checks passed. HTTP checks verify that files and query routes are served; they do not prove interactive browser authentication or form workflows.

## Canonical production safety

An earlier upload included `main` branch metadata and Vercel inferred a production target. The Vercel project was paused to prevent additional unreviewed releases. The older READY deployment still serves its own Vercel alias, while the latest deployment record is BLOCKED. This Vercel alias is not the public production portal and must not be used in canonical metadata, sitemaps, payment origins or OAuth redirect configuration. Do not unpause the Vercel project or assign public traffic to it.

## GitHub automatic deployments

Vercel's Git integration could not be created because the Vercel account did not have a GitHub Login Connection. Vercel returned: `You need to add a Login Connection to your GitHub account first.`

To enable automatic deployments:
1. Open the Vercel dashboard and select the account avatar.
2. Open **Settings → Authentication**.
3. Under Login Connections, connect and authorise the GitHub account that owns `kingpinpkaytee-dot/global-music-submission-portal`.
4. Link the intended project to that repository and verify the production branch and deployment target.

The Vercel connector still does not report a Git-linked project or GitHub Login Connection. Do not assume Git pushes automatically deploy until this is confirmed in Vercel.

## Remaining application acceptance gates

- Complete browser sign-up, email confirmation, sign-in, sign-out and password-recovery checks over HTTPS.
- Exercise artist profile saves, live credit balance and destination selector with an artist test account.
- Confirm that an ineligible directory destination is rejected without charging credits.
- Exercise Marketplace share and admin moderation with an administrator test account.
- Exercise admin directory create/update, evidence URL validation, verified/public toggles and deactivation.
- Confirm Google OAuth provider settings, Site URL and redirect allowlist.
- Populate only genuine directory records with evidence. No public verified directory entries are currently populated.
- Deploy and verify actual delivery adapters before enabling directory integration/acceptance flags.
- Complete admin campaign review and weekly Top 5 selection.
- Finish privacy, terms, content-rights, moderation, account deletion and retention policies.
- Obtain explicit production-release approval before unpausing or assigning the canonical production domain.
