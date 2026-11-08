-- Revoke direct invocation of trigger-only SECURITY DEFINER routines.
-- PostgreSQL executes trigger/event-trigger functions through their registered
-- trigger contexts; application roles do not need direct EXECUTE privileges.
BEGIN;
REVOKE ALL ON FUNCTION public.guard_artist_profile_privileges() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_artist() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
COMMIT;
