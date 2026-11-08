# Artist Frequency — Global Music Submission Portal

**Motto: Music. Passion. Legacy.**

Artist Frequency is a free, artist-first music discovery and submission platform concept. It is designed to help independent artists find relevant playlist and radio opportunities, submit releases, and track campaign activity in one place.

## Current repository contents

- `index.html` — responsive static frontend demonstration.
- `supabase/migrations/0001_core_platform.sql` — prepared PostgreSQL schema for artist profiles, submissions, credit ledger, balance view and Row Level Security.
- `.env.example` — safe public-client configuration template with placeholders only.
- `docs/PLATFORM_ARCHITECTURE.md` — authentication, submission, credits and security architecture.

## Frontend demonstration features

- Track submission form for public DSP links.
- Genre and country selection, with local-first discovery categories.
- Playlist and radio opportunity directory concepts.
- Artist dashboard preview with Pending, Approved and Declined statuses.
- Browser-local storage for demonstration submissions.
- Clear disclosure that listings and statuses are not live curator integrations.

## Phase 2 foundation prepared

The database migration defines:

- One artist profile linked to each Supabase Auth user.
- Persistent artist submission records.
- Status protections so artists cannot directly approve or decline their own submissions.
- An append-only credit ledger and calculated balance view.
- Row Level Security policies restricting artist data to its owner.

**This is prepared infrastructure, not a live backend.** The migration has not been applied to a Supabase project, and authentication, persistent submissions and server-side credit operations are not yet connected to the website.

## Artist-first principles

- Free artist access; no paid placement promises.
- No guaranteed playlist additions, streams or radio plays.
- Transparent submission status and curator feedback.
- Country-of-origin discovery before wider international recommendations.
- Curator and station listings must be verified before being presented as active opportunities.

## Credit policy — decision required

The initial product brief proposes 40 free credits and describes a reset “every Monday of every Month.” The exact calendar rule needs clarification before any automatic reset is implemented. Per-submission costs, rollover and refund rules are also not yet defined. The frontend balance is illustrative only.

## Planned development phases

1. Confirm product identity, artist journey and credit policy.
2. Connect Supabase Auth and apply/test database migration.
3. Build secure server-side submission and credit transactions.
4. Implement verified playlist, curator and radio directories.
5. Add track metadata lookup and explainable genre/opportunity matching.
6. Add curator workflows and artist notifications.
7. Build campaign analytics, soundtrack tracking and artist reporting.
8. Add moderation, privacy controls, security protections and production deployment checks.

## Development

The current frontend is static HTML/CSS/JavaScript and can be previewed by opening `index.html`. No build tooling is required for the current demo.

## Brand

**Artist Frequency**  
*Music. Passion. Legacy.*
