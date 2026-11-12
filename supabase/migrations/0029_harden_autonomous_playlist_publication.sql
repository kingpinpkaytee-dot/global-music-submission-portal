-- Defense-in-depth for unattended playlist publication.
-- This migration is applied after 0028. It publishes only playlists that pass
-- the user's hard gates and a fresh, source-backed, independent corroboration.
BEGIN;

CREATE TABLE IF NOT EXISTS public.opportunity_discovery_runtime_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  publication_policy_version integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.opportunity_discovery_runtime_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunity_discovery_runtime_config FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.opportunity_discovery_runtime_config TO service_role;
INSERT INTO public.opportunity_discovery_runtime_config(singleton,publication_policy_version)
VALUES (true,2)
ON CONFLICT (singleton) DO UPDATE
SET publication_policy_version=EXCLUDED.publication_policy_version,updated_at=now();


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
  primary_host text;
  independent_host text;
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
  primary_host := regexp_replace(lower(split_part(split_part(coalesce(candidate.source_url,''), '://', 2), '/', 1)), '^www[.]', '');
  independent_host := regexp_replace(lower(split_part(split_part(coalesce(evidence->>'independent_source_url',''), '://', 2), '/', 1)), '^www[.]', '');

  IF candidate.category <> 'playlist'
     OR evidence IS NULL
     OR evidence->>'schema_version' IS DISTINCT FROM '2'
     OR coalesce((evidence->>'score')::integer,0) < 100
     OR evidence->>'score_type' IS DISTINCT FROM 'rule_gate_completion'
     OR evidence->>'reachable' IS DISTINCT FROM 'true'
     OR evidence->>'direct_page_evidence' IS DISTINCT FROM 'true'
     OR evidence->>'submission_route_found' IS DISTINCT FROM 'true'
     OR evidence->>'category_match' IS DISTINCT FROM 'true'
     OR evidence->>'canonical_destination' IS DISTINCT FROM 'true'
     OR evidence->>'independent_corroboration' IS DISTINCT FROM 'true'
     OR evidence->>'independent_source_reachable' IS DISTINCT FROM 'true'
     OR evidence->>'independent_identity_match' IS DISTINCT FROM 'true'
     OR evidence->>'independent_category_match' IS DISTINCT FROM 'true'
     OR coalesce(evidence->>'independent_source_url','') !~* '^https://'
     OR coalesce(evidence->>'submission_route_url','') IS DISTINCT FROM coalesce(candidate.submission_url,'')
     OR candidate.website_url IS NULL
     OR coalesce(evidence->>'individual_playlist_url','') IS DISTINCT FROM coalesce(candidate.website_url,'')
     OR coalesce(evidence->>'individual_playlist_url','') !~* '^https://open[.]spotify[.]com/playlist/[A-Za-z0-9]+([/?#].*)?$'
     OR candidate.activity_status IS DISTINCT FROM 'active'
     OR candidate.follower_count IS NULL OR candidate.follower_count <= 100
     OR coalesce((evidence->>'follower_count')::bigint,0) <= 100
     OR (evidence->>'follower_count')::bigint IS DISTINCT FROM candidate.follower_count
     OR candidate.response_rate IS NULL OR candidate.response_rate < 0.5 OR candidate.response_rate > 100
     OR (evidence->>'response_rate')::numeric IS DISTINCT FROM candidate.response_rate
     OR coalesce(evidence->>'metrics_source_url','') !~* '^https://'
     OR lower(coalesce(evidence->>'metrics_source_domain','')) IS DISTINCT FROM lower(coalesce(evidence->>'primary_source_domain',''))
     OR candidate.auto_verified_at IS NULL
     OR candidate.auto_verified_at < now() - interval '6 hours'
     OR candidate.last_checked_at IS NULL
     OR candidate.last_checked_at < now() - interval '6 hours'
     OR candidate.source_url IS NULL OR candidate.evidence_url IS NULL OR candidate.submission_url IS NULL
     OR candidate.source_url !~* '^https://'
     OR candidate.evidence_url !~* '^https://'
     OR candidate.evidence_url IS DISTINCT FROM candidate.source_url
     OR candidate.submission_url !~* '^https://'
     OR candidate.website_url !~* '^https://open[.]spotify[.]com/playlist/[A-Za-z0-9]+([/?#].*)?$'
     OR lower(candidate.source_url) LIKE '%news.google.com%'
     OR lower(candidate.evidence_url) LIKE '%news.google.com%'
     OR lower(candidate.submission_url) LIKE '%news.google.com%'
     OR primary_host = ''
     OR independent_host = ''
     OR independent_host = primary_host
     OR primary_host NOT IN (lower(evidence->>'primary_source_host'), 'www.' || lower(evidence->>'primary_source_host'))
     OR independent_host NOT IN (lower(evidence->>'independent_source_host'), 'www.' || lower(evidence->>'independent_source_host'))
     OR coalesce(evidence->>'primary_source_domain','') = ''
     OR coalesce(evidence->>'independent_source_domain','') = ''
     OR lower(evidence->>'primary_source_domain') = lower(evidence->>'independent_source_domain')
     OR lower(evidence->>'independent_source_url') LIKE '%news.google.com%'
     OR lower(evidence->>'metrics_source_url') LIKE '%news.google.com%'
  THEN
    RETURN jsonb_build_object('status','held','reason','Autonomous playlist verification gates were not satisfied');
  END IF;

  -- Serialize duplicate checks for the same public playlist before insertion.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lower(candidate.website_url), 0));

  SELECT id INTO saved_id
  FROM public.opportunity_directories
  WHERE category = 'playlist'
    AND (
      lower(coalesce(website_url,'')) = lower(candidate.website_url)
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
    activity_status,follower_count,response_rate,first_seen_at,last_checked_at,
    source_evidence_url,data_confidence,is_integrated,accepts_submissions
  ) VALUES (
    candidate.category,candidate.name,candidate.country,candidate.website_url,
    candidate.submission_url,candidate.contact_email,coalesce(candidate.genres,'{}'::text[]),
    true,true,true,candidate.evidence_url,now(),NULL,
    candidate.source_name,candidate.source_url,candidate.dsp_name,candidate.submission_method,
    candidate.accepts_free_submissions,candidate.activity_status,candidate.follower_count,
    candidate.response_rate,candidate.first_seen_at,coalesce(candidate.last_checked_at,now()),
    candidate.evidence_url,'source_confirmed',false,false
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
