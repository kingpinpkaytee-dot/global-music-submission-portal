# Artist Frequency — Core Platform Architecture

## Phase 2 foundation

The initial database target is Supabase: PostgreSQL for persistent records and Supabase Auth for identity. The SQL migration in `supabase/migrations/0001_core_platform.sql` creates:

- `artist_profiles`: one artist profile per authenticated user.
- `artist_submissions`: persistent track submissions and moderation status.
- `credit_ledger`: append-only credit transaction history.
- `artist_credit_balances`: balance view calculated from ledger entries.

A database trigger creates a basic artist profile after account creation.

## Authentication flow

1. Artist registers through Supabase Auth (email/password or a later approved identity provider).
2. Supabase verifies the identity and issues a session.
3. The database trigger creates the artist profile.
4. Row Level Security restricts profile and submission reads to the signed-in artist.
5. Password recovery and email verification are handled through Supabase Auth configuration.

Do not collect or store raw passwords in application tables.

## Submission flow

1. Client validates required fields for usability.
2. Trusted server-side endpoint validates the DSP URL and submission payload again.
3. Server checks account state, abuse limits and available credits.
4. Server creates the submission and ledger debit in one database transaction.
5. Submission begins in `pending` state.
6. A trusted curator/moderator workflow changes status to `approved` or `declined` and records feedback.

Artists cannot directly update moderation status or curator feedback under the included RLS policies.

## Credit policy — not yet activated

The first website mock-up displays a proposed 40-credit allowance. The exact grant timing is unresolved: the initial product note says credits reset “every Monday of every Month,” which needs a precise calendar definition before automation. Per-submission costs, rollover, refunds, abuse controls and launch grants must also be agreed.

Until then, do not schedule automatic grants or deduct credits. When implemented, all balance changes must be server-side ledger entries. Never trust a balance sent by a browser.

## Security checklist before launch

- Configure Supabase email verification and password recovery.
- Review and test all RLS policies using artist A, artist B and unauthenticated sessions.
- Keep service-role credentials server-side only.
- Add rate limits, bot protection and request validation.
- Validate track URLs and reject unsafe schemes.
- Add curator/admin roles using a protected server-managed role mechanism; never allow users to self-assign privileges.
- Add audit logging for moderation and credit adjustments.
- Configure backups, retention and privacy/deletion workflows.
- Publish terms, privacy notice and content/rights policy.

## Current status

The public repository contains a static frontend demonstration. This migration is a prepared backend foundation; it has not been applied to a live Supabase project, and authentication/database functionality is not live yet. No credentials have been created or committed.
