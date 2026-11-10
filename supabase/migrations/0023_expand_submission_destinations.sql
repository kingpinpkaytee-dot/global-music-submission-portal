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


-- Extend the protected administrator directory RPC to accept contact records.
CREATE OR REPLACE FUNCTION public.admin_upsert_opportunity_directory(
  p_category text,
  p_name text,
  p_country text DEFAULT NULL,
  p_website_url text DEFAULT NULL,
  p_submission_url text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_genres text[] DEFAULT '{}'::text[],
  p_is_verified boolean DEFAULT false,
  p_is_active boolean DEFAULT true,
  p_is_public boolean DEFAULT false,
  p_verification_evidence_url text DEFAULT NULL,
  p_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $
DECLARE saved_id uuid;
BEGIN
  IF NOT public.is_site_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_category IS NULL OR p_category NOT IN ('platform','curator','radio_station','blogger','playlist','website','contact') THEN
    RAISE EXCEPTION 'Unsupported directory category';
  END IF;
  IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Directory name must contain 1 to 160 characters';
  END IF;
  IF coalesce(char_length(p_country),0)>80 OR coalesce(char_length(p_contact_email),0)>254
     OR coalesce(array_length(p_genres,1),0)>20 THEN
    RAISE EXCEPTION 'Directory metadata exceeds allowed limits';
  END IF;
  IF p_website_url IS NOT NULL AND p_website_url !~* '^https?://' THEN RAISE EXCEPTION 'Website URL must use http or https'; END IF;
  IF p_submission_url IS NOT NULL AND p_submission_url !~* '^https?://' THEN RAISE EXCEPTION 'Submission URL must use http or https'; END IF;
  IF p_is_verified AND (p_verification_evidence_url IS NULL OR p_verification_evidence_url !~* '^https?://') THEN
    RAISE EXCEPTION 'A valid verification evidence URL is required before marking a listing verified';
  END IF;
  IF p_is_public AND (NOT p_is_verified OR NOT p_is_active) THEN
    RAISE EXCEPTION 'Only verified and active directory records may be public';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.opportunity_directories (
      category,name,country,website_url,submission_url,contact_email,genres,
      is_verified,is_active,is_public,verification_evidence_url,verified_at,verified_by,
      is_integrated,accepts_submissions
    ) VALUES (
      p_category,btrim(p_name),nullif(btrim(coalesce(p_country,'')),''),
      nullif(btrim(coalesce(p_website_url,'')),''),nullif(btrim(coalesce(p_submission_url,'')),''),
      nullif(btrim(coalesce(p_contact_email,'')),''),coalesce(p_genres,'{}'::text[]),
      p_is_verified,p_is_active,p_is_public,
      CASE WHEN p_is_verified THEN p_verification_evidence_url ELSE NULL END,
      CASE WHEN p_is_verified THEN now() ELSE NULL END,
      CASE WHEN p_is_verified THEN auth.uid() ELSE NULL END,false,false
    ) RETURNING id INTO saved_id;
  ELSE
    UPDATE public.opportunity_directories
    SET category=p_category,name=btrim(p_name),
      country=nullif(btrim(coalesce(p_country,'')),''),
      website_url=nullif(btrim(coalesce(p_website_url,'')),''),
      submission_url=nullif(btrim(coalesce(p_submission_url,'')),''),
      contact_email=nullif(btrim(coalesce(p_contact_email,'')),''),
      genres=coalesce(p_genres,'{}'::text[]),
      is_verified=p_is_verified,is_active=p_is_active,is_public=p_is_public,
      verification_evidence_url=CASE WHEN p_is_verified THEN p_verification_evidence_url ELSE NULL END,
      verified_at=CASE WHEN p_is_verified THEN coalesce(verified_at,now()) ELSE NULL END,
      verified_by=CASE WHEN p_is_verified THEN coalesce(verified_by,auth.uid()) ELSE NULL END,
      accepts_submissions=CASE WHEN p_is_verified AND p_is_active AND p_is_public THEN accepts_submissions ELSE false END,
      updated_at=now()
    WHERE id=p_id RETURNING id INTO saved_id;
    IF saved_id IS NULL THEN RAISE EXCEPTION 'Directory record not found'; END IF;
  END IF;
  RETURN saved_id;
END;
$;

REVOKE ALL ON FUNCTION public.admin_upsert_opportunity_directory(
  text,text,text,text,text,text,text[],boolean,boolean,boolean,text,uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_opportunity_directory(
  text,text,text,text,text,text,text[],boolean,boolean,boolean,text,uuid
) TO authenticated;


ALTER TABLE public.opportunity_discovery_runs
  DROP CONSTRAINT IF EXISTS opportunity_discovery_runs_category_check;
ALTER TABLE public.opportunity_discovery_runs
  ADD CONSTRAINT opportunity_discovery_runs_category_check
  CHECK (category IN ('playlist','curator','radio_station','blogger','platform','website','contact'));

ALTER TABLE public.opportunity_discovery_candidates
  DROP CONSTRAINT IF EXISTS opportunity_discovery_candidates_category_check;
ALTER TABLE public.opportunity_discovery_candidates
  ADD CONSTRAINT opportunity_discovery_candidates_category_check
  CHECK (category IN ('playlist','curator','radio_station','blogger','platform','website','contact'));

COMMIT;
