-- Install pg_cron and register the two production automation jobs.
-- pg_cron uses UTC on this project. South Africa is UTC+2 year-round:
-- Sunday 22:05 UTC is Monday 00:05 Africa/Johannesburg.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'artist-frequency-weekly-credit-reset',
      'artist-frequency-marketplace-publisher'
    )
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'artist-frequency-weekly-credit-reset',
    '5 22 * * 0',
    'SELECT public.run_weekly_credit_reset();'
  );

  PERFORM cron.schedule(
    'artist-frequency-marketplace-publisher',
    '*/5 * * * *',
    'SELECT public.publish_due_marketplace_tracks();'
  );
END;
$$;
