-- Disable bulk publication at the database boundary.
-- Opportunities must pass the individual admin review RPC.
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_publish_all_pending_opportunity_candidates()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_site_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RAISE EXCEPTION 'Bulk publication is disabled. Review and approve each opportunity individually.';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_publish_all_pending_opportunity_candidates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_all_pending_opportunity_candidates() TO authenticated;

COMMIT;
