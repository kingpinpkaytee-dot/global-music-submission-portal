-- Artist Frequency opportunity intelligence foundation.
-- Discovery candidates stay private until an administrator verifies and publishes them.
-- Provider credentials and discovery workers must run server-side, never in the browser.
BEGIN;

ALTER TABLE public.opportunity_directories
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS dsp_name text,
  ADD COLUMN IF NOT EXISTS submission_method text
    CHECK (submission_method IS NULL OR submission_method IN ('portal','email','form','platform_api','editorial_pitch','podcast_guest','unknown')),
  ADD COLUMN IF NOT EXISTS accepts_free_submissions boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activity_status text NOT NULL DEFAULT 'unknown'
    CHECK (activity_status IN ('unknown','active','paused','closed')),
  ADD COLUMN IF NOT EXISTS follower_count bigint CHECK (follower_count IS NULL OR follower_count >= 0),
  ADD COLUMN IF NOT EXISTS approval_rate numeric(5,2) CHECK (approval_rate IS NULL OR approval_rate BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS response_rate numeric(5,2) CHECK (response_rate IS NULL OR response_rate BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS curator_interaction_score numeric(5,2) CHECK (curator_interaction_score IS NULL OR curator_interaction_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_evidence_url text,
  ADD COLUMN IF NOT EXISTS data_confidence text NOT NULL DEFAULT 'unverified'
    CHECK (data_confidence IN ('unverified','source_confirmed','admin_verified'));

ALTER TABLE public.opportunity_directories
  ADD CONSTRAINT opportunity_directories_source_url_scheme
    CHECK (source_url IS NULL OR source_url ~* '^https?://'),
  ADD CONSTRAINT opportunity_directories_source_evidence_url_scheme
    CHECK (source_evidence_url IS NULL OR source_evidence_url ~* '^https?://');

COMMENT ON COLUMN public.opportunity_directories.approval_rate IS
  'Only a measured, source-attributed rate may be stored. NULL means no reliable approval-rate evidence.';
COMMENT ON COLUMN public.opportunity_directories.curator_interaction_score IS
  'Artist Frequency engagement metric only when its calculation and observation window are documented; never a fabricated curator rating.';
COMMENT ON COLUMN public.opportunity_directories.activity_status IS
  'Last verified activity state. Unknown is the safe default for newly discovered candidates.';

CREATE TABLE IF NOT EXISTS public.opportunity_discovery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  query_text text NOT NULL,
  category text NOT NULL CHECK (category IN ('playlist','curator','radio_station','blogger','platform','website')),
  dsp_name text,
  genres text[] NOT NULL DEFAULT '{}',
  countries text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','partial','failed')),
  candidates_found integer NOT NULL DEFAULT 0 CHECK (candidates_found >= 0),
  candidates_verified integer NOT NULL DEFAULT 0 CHECK (candidates_verified >= 0),
  error_summary text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES public.artist_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS opportunity_discovery_runs_created_idx
  ON public.opportunity_discovery_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS opportunity_discovery_runs_status_idx
  ON public.opportunity_discovery_runs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.opportunity_discovery_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.opportunity_discovery_runs(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('playlist','curator','radio_station','blogger','platform','website')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  country text,
  dsp_name text,
  genres text[] NOT NULL DEFAULT '{}',
  website_url text,
  submission_url text,
  contact_email text,
  submission_method text NOT NULL DEFAULT 'unknown'
    CHECK (submission_method IN ('portal','email','form','platform_api','editorial_pitch','podcast_guest','unknown')),
  accepts_free_submissions boolean NOT NULL DEFAULT false,
  activity_status text NOT NULL DEFAULT 'unknown'
    CHECK (activity_status IN ('unknown','active','paused','closed')),
  follower_count bigint CHECK (follower_count IS NULL OR follower_count >= 0),
  approval_rate numeric(5,2) CHECK (approval_rate IS NULL OR approval_rate BETWEEN 0 AND 100),
  response_rate numeric(5,2) CHECK (response_rate IS NULL OR response_rate BETWEEN 0 AND 100),
  curator_interaction_score numeric(5,2) CHECK (curator_interaction_score IS NULL OR curator_interaction_score BETWEEN 0 AND 100),
  source_name text NOT NULL,
  source_url text NOT NULL CHECK (source_url ~* '^https?://'),
  evidence_url text CHECK (evidence_url IS NULL OR evidence_url ~* '^https?://'),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending','accepted','rejected','duplicate')),
  reviewed_by uuid REFERENCES public.artist_profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  directory_id uuid REFERENCES public.opportunity_directories(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS opportunity_candidates_review_idx
  ON public.opportunity_discovery_candidates(review_status, created_at DESC);
CREATE INDEX IF NOT EXISTS opportunity_candidates_category_idx
  ON public.opportunity_discovery_candidates(category, activity_status, accepts_free_submissions);
CREATE INDEX IF NOT EXISTS opportunity_candidates_dsp_idx
  ON public.opportunity_discovery_candidates(dsp_name, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS opportunity_candidates_source_url_uidx
  ON public.opportunity_discovery_candidates(category, lower(source_url));

ALTER TABLE public.opportunity_discovery_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_discovery_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read discovery runs" ON public.opportunity_discovery_runs;
CREATE POLICY "Admins read discovery runs"
  ON public.opportunity_discovery_runs FOR SELECT TO authenticated
  USING (public.is_site_admin());

DROP POLICY IF EXISTS "Admins read discovery candidates" ON public.opportunity_discovery_candidates;
CREATE POLICY "Admins read discovery candidates"
  ON public.opportunity_discovery_candidates FOR SELECT TO authenticated
  USING (public.is_site_admin());

REVOKE ALL ON public.opportunity_discovery_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.opportunity_discovery_candidates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.opportunity_discovery_runs TO authenticated;
GRANT SELECT ON public.opportunity_discovery_candidates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunity_discovery_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunity_discovery_candidates TO service_role;

COMMIT;
