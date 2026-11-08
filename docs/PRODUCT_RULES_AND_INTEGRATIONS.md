# Artist Frequency — Product Rules and Integrations

## Confirmed product rules

- Free artist accounts.
- Every artist receives 40 credits on registration.
- Credits reset to exactly 40 every Monday at 00:05, Africa/Johannesburg time. This naturally occurs four or five times per calendar month. Unused credits do not roll over.
- One playlist submission costs 1 credit.
- One radio-station submission costs 1 credit.
- One website-promotion submission costs 1 credit, but only when that destination is integrated and accepting submissions.
- Admin account: `kingpinpkaytee@gmail.com`; admin has unlimited submission credits and does not need a balance.
- Artists can add a Spotify Artist URL and provide supplementary profile information through a form.
- Verification is earned by following the official Artist Frequency Spotify playlist. The follow must be verified by an authorised admin or a trusted Spotify integration; never award the badge solely because an artist checks a box.
- Public site statistics must be database-backed counts of registered public artists, platforms, curators, radio stations and bloggers.
- Shared marketplace tracks require admin approval. Once approved, they are scheduled to appear 24 hours later.
- Published marketplace tracks are automatically promoted in the Artist Frequency on-site marketplace. This does not imply paid advertising or promotion on external services.
- Marketplace weekly Top 5 is an admin-curated editorial feature; no fake popularity ranking is generated.

## Sign-in providers

Email/password registration and Google sign-in are intended through Supabase Auth. Google OAuth must be enabled in the Supabase dashboard and configured in Google Cloud Console with the exact redirect URI provided by Supabase. Add authorised site URLs and redirect URLs in Supabase Auth settings. No OAuth secret belongs in frontend code or Git.

The admin address is recorded as configuration. The database trigger assigns the admin role only when Supabase reports that this email is confirmed. For stronger production governance, require MFA for the admin account and keep recovery methods current.

## Artist information form

The Spotify artist URL is only one input; it cannot supply all artist information. The profile form should ask for artist/display name, country, biography, genres, language, website/social links, contact email (private by default), artist image, and optional press-kit URL. Clearly distinguish public profile fields from private account/contact fields.

## Spotify popularity score

The artist dashboard can display the Spotify popularity value only if the configured Spotify API access returns that field for the artist and the application is authorised to use it. API access, product rules and field availability can change. Do not scrape Spotify pages, infer a score from follower counts, or invent missing values. Keep the raw Spotify field nullable and show “Not available” until a verified API sync succeeds. A separate Artist Frequency engagement score can be introduced later, but it must be labelled as the platform's own score and its formula disclosed.

## Marketplace lifecycle

1. Artist submits a public DSP link and optional artwork/description.
2. Track enters pending moderation and is not public.
3. Admin approves or declines.
4. Approval schedules publication for 24 hours later.
5. A scheduled backend job publishes due tracks and adds them to the on-site promoted marketplace feed.
6. Admin selects up to five eligible tracks for the weekly Top 5.

Automatic promotion currently means placement in the website's own marketplace feed. Social posts, paid ads, third-party playlist additions and external DSP actions require separate integrations, credentials, policies and explicit artist consent.

## Campaign builder

Artists can specify their campaign goal, preferred channels (playlist, radio, blogs, website feature), target countries, target genres, campaign brief and timing. Campaign requests are reviewed by the platform; campaign creation does not guarantee placements.

## Live backend deployment checklist

- Apply migrations in order: 0001, then 0002.
- Configure Supabase Auth email verification, password recovery and Google OAuth.
- Set Site URL and allowed redirect URLs.
- Configure MFA for admin.
- Deploy trusted Edge Functions for credit-checked submissions, Google/Spotify OAuth callbacks as needed, admin moderation and metadata sync.
- Schedule weekly credit reset every Monday at 00:05 Africa/Johannesburg.
- Schedule marketplace publication worker every five minutes.
- Test RLS using anonymous, artist A, artist B and admin accounts.
- Verify public counts are sourced from approved/public records.
- Add privacy policy, terms, moderation policy and content rights declaration.
- Store all privileged secrets in Supabase/Vercel server-side secret stores only.

## Implementation status

The migration defines the data model, row-level security foundations, admin checks, credit-reset function, moderation scheduling and public views. It is not live until applied to a Supabase project, Google OAuth is configured, and trusted scheduled backend functions are deployed. The static site must be connected to these services before any account, score, credit, verification or public counter is represented as live.
