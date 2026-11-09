-- Serialize weekly credit resets with credit-charged submissions.
-- The submit RPC locks the artist profile before reading/debiting the ledger.
-- The reset job must take the same lock or a submission racing the 00:05 reset
-- can leave the final balance at 39 or 41 instead of exactly 40.
CREATE OR REPLACE FUNCTION public.run_weekly_credit_reset()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  local_now timestamp := now() at time zone 'Africa/Johannesburg';
  week_monday date := (
    local_now::date - (extract(isodow from local_now)::int - 1)
  );
  artist record;
  locked_role text;
  current_balance bigint;
  adjustment integer;
  changed_count integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_site_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Stable ordering also keeps concurrent administrative reset invocations
  -- from acquiring artist locks in different orders.
  FOR artist IN
    SELECT p.id
    FROM public.artist_profiles p
    WHERE p.role = 'artist'
    ORDER BY p.id
  LOOP
    -- Match the per-artist mutex used by submit_artist_opportunity().
    -- Re-check role after acquiring the lock in case it changed meanwhile.
    SELECT p.role
      INTO locked_role
    FROM public.artist_profiles p
    WHERE p.id = artist.id
    FOR UPDATE;

    IF NOT FOUND OR locked_role IS DISTINCT FROM 'artist' THEN
      CONTINUE;
    END IF;

    INSERT INTO public.weekly_credit_reset_runs (
      artist_id, period_start, balance_after
    )
    VALUES (artist.id, week_monday, 40)
    ON CONFLICT DO NOTHING;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(l.amount), 0)
      INTO current_balance
    FROM public.credit_ledger l
    WHERE l.artist_id = artist.id;

    adjustment := 40 - current_balance::integer;

    IF adjustment <> 0 THEN
      INSERT INTO public.credit_ledger (
        artist_id, amount, entry_type, period_start, description
      )
      VALUES (
        artist.id,
        adjustment,
        'weekly_reset',
        week_monday,
        'Weekly Monday credit reset to 40 credits'
      );
    END IF;

    changed_count := changed_count + 1;
  END LOOP;

  RETURN changed_count;
END;
$$;

COMMENT ON FUNCTION public.run_weekly_credit_reset() IS
  'Idempotent weekly reset to exactly 40 credits. Locks each artist profile to serialize against credit-charged submissions.';
