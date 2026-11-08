-- Security and concurrency hardening for Artist Frequency.
-- Apply only after reviewing the linked project's migration history and dry-run.

-- Serialize an artist's submissions by locking their profile row before reading
-- the ledger. Concurrent submissions by one artist now queue behind this lock.
create or replace function public.submit_artist_opportunity(
  p_track_title text,
  p_artist_name text,
  p_track_url text,
  p_genre text,
  p_country text,
  p_opportunity_type text,
  p_target_id uuid,
  p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_artist uuid := auth.uid();
  current_role text;
  available_credits bigint;
  expected_category text;
  new_submission_id uuid;
begin
  if current_artist is null then
    raise exception 'Sign in is required';
  end if;

  if p_track_title is null or char_length(btrim(p_track_title)) not between 1 and 150
     or p_artist_name is null or char_length(btrim(p_artist_name)) not between 1 and 120
     or p_genre is null or char_length(btrim(p_genre)) not between 1 and 80
     or p_country is null or char_length(btrim(p_country)) not between 1 and 80
     or coalesce(char_length(p_notes),0) > 2000 then
    raise exception 'Submission fields are missing or exceed allowed lengths';
  end if;

  if p_opportunity_type not in ('playlist','radio','website') then
    raise exception 'Unsupported submission type';
  end if;
  if p_track_url is null or p_track_url !~* '^https?://' then
    raise exception 'A valid public track URL is required';
  end if;

  expected_category := case p_opportunity_type
    when 'playlist' then 'playlist'
    when 'radio' then 'radio_station'
    when 'website' then 'website'
  end;

  if not exists (
    select 1 from public.opportunity_directories d
    where d.id=p_target_id
      and d.category=expected_category
      and d.is_active and d.is_public and d.is_verified
  ) then
    raise exception 'This destination is not currently integrated and accepting submissions';
  end if;

  -- This row lock is the per-artist mutex for all credit-charged submissions.
  select role into current_role
  from public.artist_profiles
  where id=current_artist
  for update;

  if current_role is null then
    raise exception 'Artist profile not found';
  end if;

  if current_role <> 'admin' then
    select coalesce(sum(amount),0) into available_credits
    from public.credit_ledger
    where artist_id=current_artist;

    if available_credits < 1 then
      raise exception 'Not enough credits. Your next reset is every Monday.';
    end if;
  end if;

  insert into public.artist_submissions(
    artist_id,track_title,artist_name,track_url,genre,country,
    opportunity_type,opportunity_target_id,notes,status
  ) values (
    current_artist,btrim(p_track_title),btrim(p_artist_name),p_track_url,
    btrim(p_genre),btrim(p_country),p_opportunity_type,p_target_id,
    coalesce(p_notes,''),'pending'
  ) returning id into new_submission_id;

  if current_role <> 'admin' then
    insert into public.credit_ledger(
      artist_id,amount,entry_type,reference_id,description
    ) values (
      current_artist,-1,'submission_spend',new_submission_id,
      'One credit: '||p_opportunity_type||' submission'
    );
  end if;

  return new_submission_id;
end;
$$;

-- Remove default PUBLIC execution from all privileged SECURITY DEFINER routines.
revoke all on function public.submit_artist_opportunity(text,text,text,text,text,text,uuid,text)
  from public, anon;
grant execute on function public.submit_artist_opportunity(text,text,text,text,text,text,uuid,text)
  to authenticated;

revoke all on function public.admin_review_marketplace_track(uuid,text)
  from public, anon;
grant execute on function public.admin_review_marketplace_track(uuid,text)
  to authenticated;

-- Playlist verification remains disabled until the exact official playlist ID
-- is configured and the request schema validates that exact destination.
revoke all on function public.admin_verify_playlist_follow(uuid,boolean)
  from public, anon, authenticated;

-- Scheduler-only functions must never be callable by anonymous/browser roles.
revoke all on function public.run_weekly_credit_reset()
  from public, anon, authenticated;
grant execute on function public.run_weekly_credit_reset()
  to service_role;

revoke all on function public.publish_due_marketplace_tracks()
  from public, anon, authenticated;
grant execute on function public.publish_due_marketplace_tracks()
  to service_role;

-- RLS policies call this helper for authenticated users. Keep its exposure
-- limited to authenticated application sessions and trusted backend jobs.
revoke all on function public.is_site_admin()
  from public, anon;
grant execute on function public.is_site_admin()
  to authenticated, service_role;
