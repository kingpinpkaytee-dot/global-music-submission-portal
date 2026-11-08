-- Artist Frequency: least-privilege grants for production public tables.
-- RLS remains the row-level authorization boundary; these grants remove
-- unnecessary table operations before RLS is evaluated.
-- Service-role automation retains full table access and bypasses RLS.

REVOKE ALL PRIVILEGES ON TABLE
  public.artist_campaigns,
  public.artist_playlist_follows,
  public.artist_profiles,
  public.artist_submissions,
  public.credit_ledger,
  public.marketplace_tracks,
  public.marketplace_weekly_top5,
  public.opportunity_directories,
  public.platform_promotion_events,
  public.platform_settings,
  public.weekly_credit_reset_runs
FROM PUBLIC, anon, authenticated;

-- Artist-owned workflows (RLS policies still constrain each row).
GRANT SELECT, INSERT, UPDATE ON TABLE public.artist_campaigns TO authenticated;
GRANT SELECT, INSERT ON TABLE public.artist_playlist_follows TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.artist_profiles TO authenticated;
GRANT SELECT ON TABLE public.artist_submissions TO authenticated;
GRANT SELECT ON TABLE public.credit_ledger TO authenticated;
GRANT SELECT, INSERT ON TABLE public.marketplace_tracks TO authenticated;

-- Public read-only surfaces; RLS exposes only published/curated rows.
GRANT SELECT ON TABLE
  public.marketplace_tracks,
  public.marketplace_weekly_top5,
  public.opportunity_directories
TO anon, authenticated;

-- Internal operational tables have no direct client grants.
-- Writes to profiles/ledger/submissions and scheduled tables continue through
-- their existing SECURITY DEFINER RPCs/triggers or service-role jobs.

-- Explicitly preserve backend automation and trusted server operations.
GRANT ALL PRIVILEGES ON TABLE
  public.artist_campaigns,
  public.artist_playlist_follows,
  public.artist_profiles,
  public.artist_submissions,
  public.credit_ledger,
  public.marketplace_tracks,
  public.marketplace_weekly_top5,
  public.opportunity_directories,
  public.platform_promotion_events,
  public.platform_settings,
  public.weekly_credit_reset_runs
TO service_role;
