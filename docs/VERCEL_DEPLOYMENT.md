# Artist Frequency — Vercel Deployment State

**Updated:** 9 November 2026

## Vercel team

- Team: `kingpinpkaytee-8365s-projects` (Hobby plan).
- Canonical project: `artist-frequency`.
- Canonical project ID: `prj_CL4dVu2ZkLZ1hwgtfDTA7ICAiQQ2`.
- The canonical project remains paused. Do not unpause it until the protected preview has passed browser validation and production release is explicitly authorised.

## Current isolated preview project

The canonical project was paused after an upload was incorrectly inferred as a production deployment. A fresh, separate Vercel project was created so the updated source could be previewed without unpausing the canonical project.

- Project: `artist-frequency-preview`.
- Project ID: `prj_3kGRczydXhC2ZgoWV5uQbTjDckZ9`.
- Deployment ID: `dpl_GZjjgrfFC451k2AM2wNGvH6pLUFe`.
- Deployment URL: `https://artist-frequency-preview-qvxljsysr.vercel.app`.
- State: READY.
- Vercel deployment target reported by the API: `production` **within the isolated project named `artist-frequency-preview`**. This is not the canonical `artist-frequency` project or its production domain.
- SSO protection is enabled for all deployments in the preview project.
- A time-limited share link was created for review. Do not store the share token in Git; it expires on 10 November 2026.

Read-only HTTP checks returned status 200 for:
- The page root (`/`).
- `/src/supabase-client.js`
- `/src/auth.js`
- `/src/app.js`
- `/supabase-config.js`

The root page includes the new protected directory-management section. HTTP checks verify that files are being served; they do not prove end-to-end browser authentication or form workflows.

## Canonical production safety

An earlier upload included `main` branch metadata and Vercel inferred a production target. That deployment was already READY and could not be cancelled. The canonical `artist-frequency` project was paused to keep its production domain from serving an untested release.

Its default production alias `artist-frequency.vercel.app` should remain unavailable while the project is paused. The latest attempt to deploy updated files to that paused project was blocked. Do not unpause it or assign production traffic as part of preview work.

## GitHub automatic deployments

Vercel's Git integration could not be created because the Vercel account did not have a GitHub Login Connection. Vercel returned: `You need to add a Login Connection to your GitHub account first.`

To enable automatic deployments:
1. Open the Vercel dashboard and select the account avatar.
2. Open **Settings → Authentication**.
3. Under Login Connections, connect and authorise the GitHub account that owns `kingpinpkaytee-dot/global-music-submission-portal`.
4. Link the intended project to that repository and verify the production branch and deployment target.

The Vercel connector still does not report a Git-linked project or GitHub Login Connection. Do not assume Git pushes automatically deploy until this is confirmed in Vercel.

## Remaining launch gates

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
