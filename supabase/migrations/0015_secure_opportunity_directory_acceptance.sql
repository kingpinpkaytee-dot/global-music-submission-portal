-- Directory acceptance hardening and protected admin directory management.
-- A directory listing is not eligible for a credit-charged submission unless
-- it is verified, public, active, integrated and explicitly accepting submissions.
BEGIN;

ALTER TABLE public.opportunity_directories
  ADD COLUMN IF NOT EXISTS is_integrated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_submissions boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_evidence_url text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.artist_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.opportunity_directories
  DROP CONSTRAINT IF EXISTS opportunity_directories_acceptance_guard,
  DROP CONSTRAINT IF EXISTS opportunity_directories_verification_evidence_url_scheme;

ALTER TABLE public.opportunity_directories
  ADD CONSTRAINT opportunity_directories_acceptance_guard
    CHECK (
      NOT accepts_submissions
      OR (
        is_integrated
        AND is_verified
        AND is_active
        AND is_public
      )
    ),
  ADD CONSTRAINT opportunity_directories_verification_evidence_url_scheme
    CHECK (
      verification_evidence_url IS NULL
      OR verification_evidence_url ~* '^https?://'
    );

CREATE INDEX IF NOT EXISTS opportunity_directories_submission_ready_idx
  ON public.opportunity_directories(category, accepts_submissions)
  WHERE is_integrated AND is_verified AND is_active AND is_public;

COMMENT ON COLUMN public.opportunity_directories.is_integrated IS
  'True only after a working Artist Frequency delivery integration has been deployed and verified.';
COMMENT ON COLUMN public.opportunity_directories.accepts_submissions IS
  'Explicit allow flag for credit-charged in-platform submissions; requires a deployed integration and verified active public listing.';
COMMENT ON COLUMN public.opportunity_directories.verification_evidence_url IS
  'Public URL used by an administrator as evidence for the directory verification decision.';

-- Admins may inspect draft, private, inactive and verified records. Other users
-- continue to see only verified, active and public directory listings.
DROP POLICY IF EXISTS "Admins read all opportunity directories" ON public.opportunity_directories;
CREATE POLICY "Admins read all opportunity directories"
ON public.opportunity_directories
FOR SELECT TO authenticated
USING (public.is_site_admin());

-- Create/update is performed by a narrow SECURITY DEFINER RPC. No direct
-- browser INSERT/UPDATE/DELETE privilege is granted on the table.
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
AS $$
DECLARE
  saved_id uuid;
BEGIN
  IF NOT public.is_site_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_category IS NULL
     OR p_category NOT IN ('platform','curator','radio_station','blogger','playlist','website') THEN
    RAISE EXCEPTION 'Unsupported directory category';
  END IF;

  IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Directory name must contain 1 to 160 characters';
  END IF;

  IF coalesce(char_length(p_country),0) > 80
     OR coalesce(char_length(p_contact_email),0) > 254
     OR coalesce(array_length(p_genres,1),0) > 20 THEN
    RAISE EXCEPTION 'Directory metadata exceeds allowed limits';
  END IF;

  IF p_website_url IS NOT NULL AND p_website_url !~* '^https?://' THEN
    RAISE EXCEPTION 'Website URL must use http or https';
  END IF;
  IF p_submission_url IS NOT NULL AND p_submission_url !~* '^https?://' THEN
    RAISE EXCEPTION 'Submission URL must use http or https';
  END IF;

  IF p_is_verified AND (
    p_verification_evidence_url IS NULL
    OR p_verification_evidence_url !~* '^https?://'
  ) THEN
    RAISE EXCEPTION 'A valid verification evidence URL is required before marking a listing verified';
  END IF;

  IF p_is_public AND (NOT p_is_verified OR NOT p_is_active) THEN
    RAISE EXCEPTION 'Only verified and active directory records may be public';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.opportunity_directories (
      category, name, country, website_url, submission_url, contact_email,
      genres, is_verified, is_active, is_public, verification_evidence_url,
      verified_at, verified_by, is_integrated, accepts_submissions
    )
    VALUES (
      p_category, btrim(p_name), nullif(btrim(coalesce(p_country,'')), ''),
      nullif(btrim(coalesce(p_website_url,'')), ''),
      nullif(btrim(coalesce(p_submission_url,'')), ''),
      nullif(btrim(coalesce(p_contact_email,'')), ''),
      coalesce(p_genres, '{}'::text[]),
      p_is_verified, p_is_active, p_is_public,
      CASE WHEN p_is_verified THEN p_verification_evidence_url ELSE NULL END,
      CASE WHEN p_is_verified THEN now() ELSE NULL END,
      CASE WHEN p_is_verified THEN auth.uid() ELSE NULL END,
      false, false
    )
    RETURNING id INTO saved_id;
  ELSE
    UPDATE public.opportunity_directories
    SET category = p_category,
        name = btrim(p_name),
        country = nullif(btrim(coalesce(p_country,'')), ''),
        website_url = nullif(btrim(coalesce(p_website_url,'')), ''),
        submission_url = nullif(btrim(coalesce(p_submission_url,'')), ''),
        contact_email = nullif(btrim(coalesce(p_contact_email,'')), ''),
        genres = coalesce(p_genres, '{}'::text[]),
        is_verified = p_is_verified,
        is_active = p_is_active,
        is_public = p_is_public,
        verification_evidence_url = CASE WHEN p_is_verified THEN p_verification_evidence_url ELSE NULL END,
        verified_at = CASE WHEN p_is_verified THEN coalesce(verified_at, now()) ELSE NULL END,
        verified_by = CASE WHEN p_is_verified THEN coalesce(verified_by, auth.uid()) ELSE NULL END,
        accepts_submissions = CASE
          WHEN p_is_verified AND p_is_active AND p_is_public THEN accepts_submissions
          ELSE false
        END,
        updated_at = now()
    WHERE id = p_id
    RETURNING id INTO saved_id;

    IF saved_id IS NULL THEN
      RAISE EXCEPTION 'Directory record not found';
    END IF;
  END IF;

  RETURN saved_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_opportunity_directory(
  text,text,text,text,text,text,text[],boolean,boolean,boolean,text,uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_opportunity_directory(
  text,text,text,text,text,text,text[],boolean,boolean,boolean,text,uuid
) TO authenticated;

-- Redefine the credit-charged submission RPC so no credit can be spent until
-- a working integration has been deployed and the destination explicitly
-- marked as accepting submissions by a trusted backend process.
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

  IF p_opportunity_type NOT IN ('playlist','radio','website') THEN
    RAISE EXCEPTION 'Unsupported submission type';
  END IF;
  IF p_track_url IS NULL OR p_track_url !~* '^https?://' THEN
    RAISE EXCEPTION 'A valid public track URL is required';
  END IF;

  expected_category := CASE p_opportunity_type
    WHEN 'playlist' THEN 'playlist'
    WHEN 'radio' THEN 'radio_station'
    WHEN 'website' THEN 'website'
  END;

  IF NOT EXISTS (
    SELECT 1 FROM public.opportunity_directories d
    WHERE d.id = p_target_id
      AND d.category = expected_category
      AND d.is_active
      AND d.is_public
      AND d.is_verified
      AND d.is_integrated
      AND d.accepts_submissions
  ) THEN
    RAISE EXCEPTION 'This destination is not integrated and actively accepting submissions. No credit was charged.';
  END IF;

  -- Shared per-artist mutex with run_weekly_credit_reset().
  SELECT role INTO current_role
  FROM public.artist_profiles
  WHERE id = current_artist
  FOR UPDATE;

  IF current_role IS NULL THEN
    RAISE EXCEPTION 'Artist profile not found';
  END IF;

  IF current_role <> 'admin' THEN
    SELECT coalesce(sum(amount),0) INTO available_credits
    FROM public.credit_ledger
    WHERE artist_id = current_artist;

    IF available_credits < 1 THEN
      RAISE EXCEPTION 'Not enough credits. Your next reset is every Monday.';
    END IF;
  END IF;

  INSERT INTO public.artist_submissions (
    artist_id, track_title, artist_name, track_url, genre, country,
    opportunity_type, opportunity_target_id, notes, status
  )
  VALUES (
    current_artist, btrim(p_track_title), btrim(p_artist_name), p_track_url,
    btrim(p_genre), btrim(p_country), p_opportunity_type, p_target_id,
    coalesce(p_notes,''), 'pending'
  )
  RETURNING id INTO new_submission_id;

  IF current_role <> 'admin' THEN
    INSERT INTO public.credit_ledger (
      artist_id, amount, entry_type, reference_id, description
    )
    VALUES (
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

COMMIT;
