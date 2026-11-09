-- Restrict direct execution of the updated-at trigger helper.
-- This function is invoked by existing table triggers; browser roles do not
-- need direct EXECUTE permission on it.
BEGIN;
REVOKE ALL ON FUNCTION public.set_updated_at()
  FROM PUBLIC, anon, authenticated;
COMMIT;
