-- Artist Frequency: secure default privileges for future public-schema objects.
-- Supabase's postgres role currently auto-grants broad table/view and sequence
-- privileges to anon/authenticated, and function EXECUTE to browser roles.
-- Existing objects are controlled by the explicit grants in migrations 0009
-- and 0010 and the RPC grants in migrations 0004-0007. These changes close
-- defaults for objects created in the future by the postgres migration owner.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;

-- PostgreSQL grants EXECUTE on newly created functions to PUBLIC by default.
-- Remove that global default, then remove Supabase browser-role defaults too.
-- Client-facing RPCs must receive explicit GRANT EXECUTE statements.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- service_role defaults are deliberately preserved for trusted backend jobs.
