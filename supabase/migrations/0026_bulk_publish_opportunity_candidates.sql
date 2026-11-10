-- Admin-authorized bulk publication for the researched opportunity batch.
-- Every published entry receives a visible public listing but remains external-only:
-- is_integrated=false and accepts_submissions=false.
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_publish_all_pending_opportunity_candidates()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  candidate public.opportunity_discovery_candidates%ROWTYPE;
  saved_id uuid;
  published_count integer := 0;
  duplicate_count integer := 0;
  skipped_count integer := 0;
BEGIN
  IF NOT public.is_site_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  FOR candidate IN
    SELECT *
    FROM public.opportunity_discovery_candidates
    WHERE review_status = 'pending'
    ORDER BY created_at ASC, name ASC
    FOR UPDATE
  LOOP
    IF candidate.source_url IS NULL
       OR candidate.evidence_url IS NULL
       OR (candidate.submission_url IS NULL AND candidate.contact_email IS NULL) THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    saved_id := NULL;
    SELECT d.id INTO saved_id
    FROM public.opportunity_directories d
    WHERE d.category = candidate.category
      AND (
        lower(d.name) = lower(candidate.name)
        OR lower(coalesce(d.source_url, '')) = lower(candidate.source_url)
      )
    LIMIT 1;

    IF saved_id IS NOT NULL THEN
      UPDATE public.opportunity_discovery_candidates
      SET review_status = 'duplicate',
          reviewed_by = auth.uid(),
          reviewed_at = now(),
          directory_id = saved_id
      WHERE id = candidate.id;
      duplicate_count := duplicate_count + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.opportunity_directories (
      category, name, country, website_url, submission_url, contact_email, genres,
      is_verified, is_active, is_public, verification_evidence_url, verified_at, verified_by,
      source_name, source_url, dsp_name, submission_method, accepts_free_submissions,
      activity_status, first_seen_at, last_checked_at, source_evidence_url, data_confidence,
      is_integrated, accepts_submissions
    ) VALUES (
      candidate.category, candidate.name, candidate.country, candidate.website_url,
      candidate.submission_url, candidate.contact_email, coalesce(candidate.genres, '{}'::text[]),
      true, true, true, candidate.evidence_url, now(), auth.uid(),
      candidate.source_name, candidate.source_url, candidate.dsp_name, candidate.submission_method,
      candidate.accepts_free_submissions, candidate.activity_status, candidate.first_seen_at,
      coalesce(candidate.last_checked_at, now()), candidate.evidence_url, 'admin_verified',
      false, false
    ) RETURNING id INTO saved_id;

    UPDATE public.opportunity_discovery_candidates
    SET review_status = 'accepted',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        directory_id = saved_id
    WHERE id = candidate.id;

    published_count := published_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'published', published_count,
    'duplicates', duplicate_count,
    'skipped', skipped_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_publish_all_pending_opportunity_candidates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_all_pending_opportunity_candidates() TO authenticated;

COMMIT;
