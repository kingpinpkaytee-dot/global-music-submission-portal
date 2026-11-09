-- Extend artist profiles with structured genres and a press-kit URL.
-- These fields are artist-editable profile data; existing RLS and the
-- privileged-field guard continue to protect role, verification and score data.
BEGIN;

ALTER TABLE public.artist_profiles
  ADD COLUMN IF NOT EXISTS genres text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS press_kit_url text;

ALTER TABLE public.artist_profiles
  DROP CONSTRAINT IF EXISTS artist_profiles_genres_limit,
  DROP CONSTRAINT IF EXISTS artist_profiles_press_kit_url_scheme;

ALTER TABLE public.artist_profiles
  ADD CONSTRAINT artist_profiles_genres_limit
    CHECK (COALESCE(array_length(genres, 1), 0) <= 20),
  ADD CONSTRAINT artist_profiles_press_kit_url_scheme
    CHECK (press_kit_url IS NULL OR press_kit_url ~* '^https?://');

COMMENT ON COLUMN public.artist_profiles.genres IS
  'Artist-selected genres and subgenres; display as artist-provided profile metadata.';
COMMENT ON COLUMN public.artist_profiles.press_kit_url IS
  'Optional public press-kit URL supplied by the artist.';

COMMIT;
