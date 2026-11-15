-- Raise playlist discovery/publication breadth by lowering only the follower minimum.
-- All other requirements remain unchanged: individual Spotify playlist, active status,
-- response rate 0.5%-100%, reachable HTTPS submission route and independent corroboration.
-- The minimum is inclusive: 15 followers qualifies; 14 does not.
BEGIN;

DO $migration$
DECLARE
  existing_definition text;
  updated_definition text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.auto_publish_verified_opportunity_candidate(uuid)'::regprocedure
  )
  INTO existing_definition;

  updated_definition := replace(
    existing_definition,
    'candidate.follower_count <= 100',
    'candidate.follower_count < 15'
  );

  updated_definition := replace(
    updated_definition,
    $$coalesce((evidence->>'follower_count')::bigint,0) <= 100$$,
    $$coalesce((evidence->>'follower_count')::bigint,0) < 15$$
  );

  IF position('candidate.follower_count < 15' IN updated_definition) = 0
     OR position($$coalesce((evidence->>'follower_count')::bigint,0) < 15$$ IN updated_definition) = 0
     OR position('candidate.follower_count <= 100' IN updated_definition) > 0
     OR position($$coalesce((evidence->>'follower_count')::bigint,0) <= 100$$ IN updated_definition) > 0
  THEN
    RAISE EXCEPTION
      'Playlist follower threshold migration could not verify both guarded expressions; no policy change was made.';
  END IF;

  IF updated_definition <> existing_definition THEN
    EXECUTE updated_definition;
  ELSE
    RAISE NOTICE 'Playlist follower minimum is already 15; no function replacement needed.';
  END IF;
END
$migration$;

COMMENT ON FUNCTION public.auto_publish_verified_opportunity_candidate(uuid)
IS 'Autonomous playlist publication requires at least 15 followers, active status, 0.5%-100% response rate, an individual public Spotify playlist, a verified HTTPS submission route and independent corroboration.';

COMMIT;
