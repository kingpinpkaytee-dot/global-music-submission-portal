-- Hardening corrections for signup confirmation and public aggregate statistics.
-- Apply after 0002_artist_frequency_features.sql.

create unique index if not exists credit_ledger_one_starter_grant_per_artist
  on public.credit_ledger(artist_id)
  where entry_type='starter_grant';

create or replace function public.handle_new_artist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_role text := 'artist';
begin
  if lower(coalesce(new.email,''))='kingpinpkaytee@gmail.com'
     and new.email_confirmed_at is not null then
    assigned_role := 'admin';
  end if;

  insert into public.artist_profiles(id,artist_name,role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'artist_name',''),
    assigned_role
  )
  on conflict(id) do update set role=excluded.role;

  if assigned_role='artist' then
    insert into public.credit_ledger(artist_id,amount,entry_type,description)
    values(new.id,40,'starter_grant','40 free starter credits')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- Re-run the profile/grant synchronizer when an email becomes confirmed too.
drop trigger if exists on_auth_user_created_artist on auth.users;
create trigger on_auth_user_created_artist
after insert or update on auth.users
for each row execute procedure public.handle_new_artist();

-- Aggregate counts are intentionally exposed through a definer-owned view;
-- it returns only aggregate integers, not underlying personal records.
drop view if exists public.public_platform_statistics;
create view public.public_platform_statistics
as
select
  (select count(*) from public.artist_profiles where profile_visibility='public')::bigint as registered_artists,
  (select count(*) from public.opportunity_directories where category='platform' and is_public and is_active and is_verified)::bigint as platforms,
  (select count(*) from public.opportunity_directories where category='curator' and is_public and is_active and is_verified)::bigint as curators,
  (select count(*) from public.opportunity_directories where category='radio_station' and is_public and is_active and is_verified)::bigint as radio_stations,
  (select count(*) from public.opportunity_directories where category='blogger' and is_public and is_active and is_verified)::bigint as bloggers;

grant select on public.public_platform_statistics to anon, authenticated;
