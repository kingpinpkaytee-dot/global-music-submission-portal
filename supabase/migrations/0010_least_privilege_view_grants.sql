-- Artist Frequency: least-privilege grants for public-schema views.
-- View ACLs are independent of base-table ACLs. In particular,
-- public_marketplace_tracks is automatically updatable, so table RLS alone
-- is not a reason to leave broad INSERT/UPDATE/DELETE grants on the view.
--
-- The public statistics view is intentionally owner-executed and returns only
-- aggregate counts filtered to public profiles and verified, active directories.
-- The other views use security_invoker=true so base-table grants and RLS apply.

REVOKE ALL PRIVILEGES ON TABLE
  public.artist_credit_balances,
  public.public_marketplace_top5,
  public.public_marketplace_tracks,
  public.public_platform_statistics
FROM PUBLIC, anon, authenticated;

-- Credit balances are an authenticated dashboard surface, never anonymous.
GRANT SELECT ON TABLE public.artist_credit_balances TO authenticated;

-- Public discovery and aggregate statistics are read-only surfaces.
GRANT SELECT ON TABLE
  public.public_marketplace_top5,
  public.public_marketplace_tracks,
  public.public_platform_statistics
TO anon, authenticated;

-- Preserve trusted backend access without granting client write access.
GRANT ALL PRIVILEGES ON TABLE
  public.artist_credit_balances,
  public.public_marketplace_top5,
  public.public_marketplace_tracks,
  public.public_platform_statistics
TO service_role;
