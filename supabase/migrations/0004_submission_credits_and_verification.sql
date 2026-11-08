-- Secure credit-charged submission RPCs and verification workflow.
-- Apply after 0003_signup_and_public_stats_hardening.sql.

-- Browser clients must not bypass the one-credit charge by inserting directly.
drop policy if exists "Artists create own submissions" on public.artist_submissions;
revoke insert, update, delete on public.artist_submissions from anon, authenticated;

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
  if p_opportunity_type not in ('playlist','radio','website') then
    raise exception 'Unsupported submission type';
  end if;
  if p_track_url !~* '^https?://' then
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

  select role into current_role
  from public.artist_profiles where id=current_artist;
  if current_role is null then
    raise exception 'Artist profile not found';
  end if;

  if current_role <> 'admin' then
    select coalesce(sum(amount),0) into available_credits
    from public.credit_ledger where artist_id=current_artist;
    if available_credits < 1 then
      raise exception 'Not enough credits. Your next reset is every Monday.';
    end if;
  end if;

  insert into public.artist_submissions(
    artist_id,track_title,artist_name,track_url,genre,country,
    opportunity_type,opportunity_target_id,notes,status
  ) values (
    current_artist,p_track_title,p_artist_name,p_track_url,p_genre,p_country,
    p_opportunity_type,p_target_id,coalesce(p_notes,''),'pending'
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

grant execute on function public.submit_artist_opportunity(text,text,text,text,text,text,uuid,text)
to authenticated;

create or replace function public.admin_verify_playlist_follow(
  p_follow_id uuid,
  p_approved boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_artist uuid;
begin
  if not public.is_site_admin() then
    raise exception 'Admin access required';
  end if;

  select artist_id into target_artist
  from public.artist_playlist_follows
  where id=p_follow_id and status='pending';

  if target_artist is null then
    raise exception 'Pending follow verification not found';
  end if;

  update public.artist_playlist_follows
  set status=case when p_approved then 'verified' else 'rejected' end,
      verified_by=auth.uid(),
      verified_at=case when p_approved then now() else null end,
      followed_at=case when p_approved then coalesce(followed_at,now()) else followed_at end
  where id=p_follow_id;

  if p_approved then
    update public.artist_profiles
    set is_verified=true,
        verified_at=now(),
        verification_playlist_followed_at=now()
    where id=target_artist;
  end if;
end;
$$;

grant execute on function public.admin_verify_playlist_follow(uuid,boolean) to authenticated;

-- Reset-run bookkeeping is internal. No direct client access is granted.
alter table public.weekly_credit_reset_runs enable row level security;
revoke all on public.weekly_credit_reset_runs from anon, authenticated;

-- Admin-only reads of all artist records and moderation queues are provided
-- through authenticated admin checks, while service-role jobs bypass RLS.
drop policy if exists "Admins read all submissions" on public.artist_submissions;
create policy "Admins read all submissions"
on public.artist_submissions for select to authenticated
using (public.is_site_admin());

drop policy if exists "Admins read all marketplace tracks" on public.marketplace_tracks;
create policy "Admins read all marketplace tracks"
on public.marketplace_tracks for select to authenticated
using (public.is_site_admin());

drop policy if exists "Admins read all campaigns" on public.artist_campaigns;
create policy "Admins read all campaigns"
on public.artist_campaigns for select to authenticated
using (public.is_site_admin());

drop policy if exists "Admins read all credit ledger" on public.credit_ledger;
create policy "Admins read all credit ledger"
on public.credit_ledger for select to authenticated
using (public.is_site_admin());
