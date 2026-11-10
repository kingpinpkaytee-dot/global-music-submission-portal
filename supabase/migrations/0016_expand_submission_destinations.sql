-- Migration 0016: expand Artist Frequency submission destinations.
-- Adds curator, promotion-platform and contact channels without bypassing
-- the trusted delivery-integration gate. No destination is auto-enabled.
BEGIN;

ALTER TABLE public.opportunity_directories
  DROP CONSTRAINT IF EXISTS opportunity_directories_category_check;
ALTER TABLE public.opportunity_directories
  ADD CONSTRAINT opportunity_directories_category_check
  CHECK (category IN ('platform','curator','radio_station','blogger','playlist','website','contact'));

ALTER TABLE public.artist_submissions
  DROP CONSTRAINT IF EXISTS artist_submissions_opportunity_type_check;
ALTER TABLE public.artist_submissions
  ADD CONSTRAINT artist_submissions_opportunity_type_check
  CHECK (opportunity_type IN ('playlist','radio','website','curator','platform','contact'));

CREATE OR REPLACE FUNCTION public.submit_artist_opportunity(
  p_track_title text,
  p_artist_name text,
  p_track_url text,
  p_genre text,
  p_country text,
  p_opportunity_type text,
  p_target_id uuid,
  p_notes text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_artist uuid := auth.uid();
  current_role text;
  available_credits bigint;
  expected_category text;
  new_submission_id uuid;
BEGIN
  IF current_artist IS NULL THEN
    RAISE EXCEPTION 'Sign in is required';
  END IF;
  IF p_track_title IS NULL OR char_length(btrim(p_track_title)) NOT BETWEEN 1 AND 150
     OR p_artist_name IS NULL OR char_length(btrim(p_artist_name)) NOT BETWEEN 1 AND 120
     OR p_genre IS NULL OR char_length(btrim(p_genre)) NOT BETWEEN 1 AND 80
     OR p_country IS NULL OR char_length(btrim(p_country)) NOT BETWEEN 1 AND 80
     OR coalesce(char_length(p_notes),0) > 2000 THEN
    RAISE EXCEPTION 'Submission fields are missing or exceed allowed lengths';
  END IF;
  IF p_opportunity_type NOT IN ('playlist','radio','website','curator','platform','contact') THEN
    RAISE EXCEPTION 'Unsupported submission type';
  END IF;
  IF p_track_url IS NULL OR p_track_url !~* '^https?://' THEN
    RAISE EXCEPTION 'A valid public track URL is required';
  END IF;

  expected_category := CASE p_opportunity_type
    WHEN 'playlist' THEN 'playlist'
    WHEN 'radio' THEN 'radio_station'
    WHEN 'website' THEN 'website'
    WHEN 'curator' THEN 'curator'
    WHEN 'platform' THEN 'platform'
    WHEN 'contact' THEN 'contact'
  END;

  IF NOT EXISTS (
    SELECT 1 FROM public.opportunity_directories d
    WHERE d.id = p_target_id
      AND d.category = expected_category
      AND d.is_active AND d.is_public AND d.is_verified
      AND d.is_integrated AND d.accepts_submissions
  ) THEN
    RAISE EXCEPTION 'This destination is not integrated and actively accepting submissions. No credit was charged.';
  END IF;

  SELECT role INTO current_role
  FROM public.artist_profiles
  WHERE id = current_artist
  FOR UPDATE;
  IF current_role IS NULL THEN
    RAISE EXCEPTION 'Artist profile not found';
  END IF;

  IF current_role <> 'admin' THEN
    SELECT coalesce(sum(amount),0) INTO available_credits
    FROM public.credit_ledger WHERE artist_id = current_artist;
    IF available_credits < 1 THEN
      RAISE EXCEPTION 'Not enough credits. Your next reset is every Monday.';
    END IF;
  END IF;

  INSERT INTO public.artist_submissions (
    artist_id, track_title, artist_name, track_url, genre, country,
    opportunity_type, opportunity_target_id, notes, status
  ) VALUES (
    current_artist, btrim(p_track_title), btrim(p_artist_name), p_track_url,
    btrim(p_genre), btrim(p_country), p_opportunity_type, p_target_id,
    coalesce(p_notes,''), 'pending'
  ) RETURNING id INTO new_submission_id;

  IF current_role <> 'admin' THEN
    INSERT INTO public.credit_ledger (
      artist_id, amount, entry_type, reference_id, description
    ) VALUES (
      current_artist, -1, 'submission_spend', new_submission_id,
      'One credit: ' || p_opportunity_type || ' submission'
    );
  END IF;
  RETURN new_submission_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_artist_opportunity(
  text,text,text,text,text,text,uuid,text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_artist_opportunity(
  text,text,text,text,text,text,uuid,text
) TO authenticated;

COMMENT ON FUNCTION public.submit_artist_opportunity(
  text,text,text,text,text,text,uuid,text
) IS 'Creates a credit-charged submission only for verified, public, active destinations with a trusted deployed delivery integration and explicit acceptance. Supports playlists, radio, websites, curators, platforms and contacts.';

COMMIT;
