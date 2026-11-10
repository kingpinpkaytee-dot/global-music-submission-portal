-- Controlled autonomous publication for independently inspected music-submission pages.
-- The worker must provide fresh, structured evidence. This does NOT enable in-platform
-- submissions or mark listings as integrated.
BEGIN;

ALTER TABLE public.opportunity_discovery_candidates
  ADD COLUMN IF NOT EXISTS auto_verification jsonb,
  ADD COLUMN IF NOT EXISTS auto_verified_at timestamptz;

CREATE INDEX IF NOT EXISTS opportunity_candidates_auto_publish_idx
  ON public.opportunity_discovery_candidates(review_status, auto_verified_at)
  WHERE auto_verified_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.auto_publish_verified_opportunity_candidate(p_candidate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  candidate public.opportunity_discovery_candidates%ROWTYPE;
  evidence jsonb;
  saved_id uuid;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  SELECT * INTO candidate
  FROM public.opportunity_discovery_candidates
  WHERE id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Candidate not found'; END IF;
  IF candidate.review_status <> 'pending' THEN
    RETURN jsonb_build_object('status','skipped','reason','Candidate is not pending');
  END IF;

  evidence := candidate.auto_verification;
  IF evidence IS NULL
     OR coalesce((evidence->>'score')::integer,0) < 95
     OR evidence->>'schema_version' <> '1'
     OR evidence->>'reachable' <> 'true'
     OR evidence->>'direct_page_evidence' <> 'true'
     OR evidence->>'submission_route_found' <> 'true'
     OR evidence->>'category_match' <> 'true'
     OR evidence->>'canonical_destination' <> 'true'
     OR candidate.auto_verified_at IS NULL
     OR candidate.auto_verified_at < now() - interval '24 hours'
     OR candidate.source_url IS NULL
     OR candidate.evidence_url IS NULL
     OR candidate.submission_url IS NULL
     OR candidate.source_url !~* '^https?://'
     OR candidate.evidence_url !~* '^https?://'
     OR candidate.submission_url !~* '^https?://'
     OR lower(candidate.source_url) LIKE '%news.google.com%'
     OR lower(candidate.evidence_url) LIKE '%news.google.com%'
     OR lower(candidate.submission_url) LIKE '%news.google.com%'
  THEN
    RETURN jsonb_build_object('status','held','reason','Automatic verification requirements were not satisfied');
  END IF;

  IF candidate.category = 'playlist' AND
     coalesce(evidence->>'individual_playlist_url','') !~* '^https://open[.]spotify[.]com/playlist/[A-Za-z0-9]+'
  THEN
    RETURN jsonb_build_object('status','held','reason','An individual Spotify playlist was not independently identified');
  END IF;

  SELECT id INTO saved_id
  FROM public.opportunity_directories
  WHERE category = candidate.category
    AND (
      lower(name) = lower(candidate.name)
      OR lower(coalesce(source_url,'')) = lower(candidate.source_url)
    )
  LIMIT 1;

  IF saved_id IS NOT NULL THEN
    UPDATE public.opportunity_discovery_candidates
    SET review_status='duplicate', reviewed_at=now(), directory_id=saved_id
    WHERE id=p_candidate_id;
    RETURN jsonb_build_object('status','duplicate','directory_id',saved_id);
  END IF;

  INSERT INTO public.opportunity_directories (
    category,name,country,website_url,submission_url,contact_email,genres,
    is_verified,is_active,is_public,verification_evidence_url,verified_at,verified_by,
    source_name,source_url,dsp_name,submission_method,accepts_free_submissions,
    activity_status,first_seen_at,last_checked_at,source_evidence_url,data_confidence,
    is_integrated,accepts_submissions
  ) VALUES (
    candidate.category,candidate.name,candidate.country,candidate.website_url,
    candidate.submission_url,candidate.contact_email,coalesce(candidate.genres,'{}'::text[]),
    true,true,true,candidate.evidence_url,now(),NULL,
    candidate.source_name,candidate.source_url,candidate.dsp_name,candidate.submission_method,
    candidate.accepts_free_submissions,candidate.activity_status,candidate.first_seen_at,
    coalesce(candidate.last_checked_at,now()),candidate.evidence_url,'source_confirmed',
    false,false
  ) RETURNING id INTO saved_id;

  UPDATE public.opportunity_discovery_candidates
  SET review_status='accepted', reviewed_at=now(), directory_id=saved_id
  WHERE id=p_candidate_id;

  RETURN jsonb_build_object('status','published','directory_id',saved_id);
END;
$$;

REVOKE ALL ON FUNCTION public.auto_publish_verified_opportunity_candidate(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_publish_verified_opportunity_candidate(uuid) TO service_role;

COMMIT;
