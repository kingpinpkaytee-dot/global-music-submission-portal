-- 0019: publish individually verified free Spotify playlist opportunities.
-- External curator submissions only; these are not in-platform integrations.
BEGIN;

ALTER TABLE public.opportunity_directories
  ADD COLUMN IF NOT EXISTS curator_name text,
  ADD COLUMN IF NOT EXISTS curator_profile_url text;

WITH opportunities(
  name, spotify_url, submission_url, curator_name, curator_profile_url,
  genres, follower_count, approval_rate, response_rate
) AS (
  VALUES
  (
    'SA Musiq Rise PR',
    'https://open.spotify.com/playlist/5b7CqShhvhs0Y6Om9m6bmC',
    'https://playlistdock.com/playlist.php?slug=sa-musiq-rise-pr',
    'Ntate Tlhako', NULL::text,
    ARRAY['Hip Hop & Rap','R&B & Soul','Afro & Amapiano','House','Pop']::text[],
    488::bigint, 2.9::numeric, 47::numeric
  ),
  (
    'Naija Afrobeats Hits 2026 🇳🇬 | Top 100 Nigeria Songs | (Updated Daily)',
    'https://open.spotify.com/playlist/4Yj3xybGxDOn6CGa1DDhJa',
    'https://playlistdock.com/playlist.php?slug=naija-afrobeats-hits-2026-top-100-nigeria-songs-updated-daily',
    'The vibe curator', 'https://open.spotify.com/user/31hiszzpln47shsts7exkrvh2mbe',
    ARRAY['Afro & Amapiano']::text[],
    448::bigint, 96.3::numeric, 71::numeric
  ),
  (
    'Melodic Rap & Pop for Night Drives',
    'https://open.spotify.com/playlist/55A0xFKVR77P2LSb6jDyiK',
    'https://playlistdock.com/playlist.php?slug=melodic-rap-pop-for-night-drives',
    'Crystal Rain', 'https://open.spotify.com/user/31bylhrsy7pt6sp4npjxdb3it5hy',
    ARRAY['Hip Hop & Rap','Afro & Amapiano']::text[],
    463::bigint, 40.7::numeric, 94::numeric
  )
)
INSERT INTO public.opportunity_directories (
  category, name, website_url, submission_url, curator_name, curator_profile_url,
  genres, is_verified, is_active, is_public, verification_evidence_url,
  verified_at, source_name, source_url, dsp_name, submission_method,
  accepts_free_submissions, activity_status, follower_count,
  approval_rate, response_rate, first_seen_at, last_checked_at,
  source_evidence_url, data_confidence, is_integrated, accepts_submissions
)
SELECT
  'playlist', o.name, o.spotify_url, o.submission_url, o.curator_name, o.curator_profile_url,
  o.genres, true, true, true, o.submission_url,
  now(), 'PlaylistDock', o.submission_url, 'Spotify', 'form',
  true, 'active', o.follower_count, o.approval_rate, o.response_rate,
  now(), now(), o.submission_url, 'source_confirmed', false, false
FROM opportunities o
WHERE NOT EXISTS (
  SELECT 1
  FROM public.opportunity_directories d
  WHERE d.category = 'playlist'
    AND lower(d.name) = lower(o.name)
);

COMMIT;
