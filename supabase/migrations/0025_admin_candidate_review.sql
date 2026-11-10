-- Admin-controlled promotion of Google Search discoveries into the public directory.
-- A human must approve each candidate. Published listings remain non-integrated.
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_review_opportunity_candidate(
  p_candidate_id uuid,
  p_decision text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  candidate public.opportunity_discovery_candidates%ROWTYPE;
  saved_id uuid;
BEGIN
  IF NOT public.is_site_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_decision NOT IN ('accept','reject') THEN RAISE EXCEPTION 'Decision must be accept or reject'; END IF;

  SELECT * INTO candidate
  FROM public.opportunity_discovery_candidates
  WHERE id=p_candidate_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Discovery candidate not found'; END IF;
  IF candidate.review_status <> 'pending' THEN RAISE EXCEPTION 'Candidate has already been reviewed'; END IF;

  IF p_decision='reject' THEN
    UPDATE public.opportunity_discovery_candidates
    SET review_status='rejected',reviewed_by=auth.uid(),reviewed_at=now()
    WHERE id=p_candidate_id;
    RETURN NULL;
  END IF;

  IF candidate.source_url IS NULL OR candidate.evidence_url IS NULL THEN
    RAISE EXCEPTION 'Candidate needs source and evidence URLs before approval';
  END IF;
  IF candidate.submission_url IS NULL AND candidate.contact_email IS NULL THEN
    RAISE EXCEPTION 'Candidate needs a submission route or public contact email';
  END IF;

  SELECT id INTO saved_id
  FROM public.opportunity_directories
  WHERE category=candidate.category
    AND (lower(name)=lower(candidate.name) OR lower(coalesce(source_url,''))=lower(candidate.source_url))
  LIMIT 1;

  IF saved_id IS NULL THEN
    INSERT INTO public.opportunity_directories (
      category,name,country,website_url,submission_url,contact_email,genres,
      is_verified,is_active,is_public,verification_evidence_url,verified_at,verified_by,
      source_name,source_url,dsp_name,submission_method,accepts_free_submissions,
      activity_status,first_seen_at,last_checked_at,source_evidence_url,data_confidence,
      is_integrated,accepts_submissions
    ) VALUES (
      candidate.category,candidate.name,candidate.country,candidate.website_url,
      candidate.submission_url,candidate.contact_email,candidate.genres,
      true,true,true,candidate.evidence_url,now(),auth.uid(),
      candidate.source_name,candidate.source_url,candidate.dsp_name,candidate.submission_method,
      candidate.accepts_free_submissions,candidate.activity_status,candidate.first_seen_at,
      coalesce(candidate.last_checked_at,now()),candidate.evidence_url,'admin_verified',
      false,false
    ) RETURNING id INTO saved_id;
  END IF;

  UPDATE public.opportunity_discovery_candidates
  SET review_status=CASE WHEN saved_id IS NULL THEN 'duplicate' ELSE 'accepted' END,
      reviewed_by=auth.uid(),reviewed_at=now(),directory_id=saved_id
  WHERE id=p_candidate_id;

  RETURN saved_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_opportunity_candidate(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_opportunity_candidate(uuid,text) TO authenticated;

COMMIT;
