-- Artist Frequency product rules and community features (Phase 3 schema)
-- Apply AFTER 0001_core_platform.sql.
-- Timezone for weekly credit reset: Africa/Johannesburg.
-- A fresh weekly allowance is 40 credits, not an additive rollover.

alter table public.artist_profiles
  add column if not exists role text not null default 'artist'
    check (role in ('artist','admin')),
  add column if not exists spotify_artist_url text,
  add column if not exists spotify_artist_id text,
  add column if not exists spotify_popularity integer,
  add column if not exists popularity_score numeric(5,2),
  add column if not exists popularity_last_synced_at timestamptz,
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists verification_playlist_followed_at timestamptz,
  add column if not exists profile_visibility text not null default 'public'
    check (profile_visibility in ('public','private'));

alter table public.artist_submissions
  add column if not exists opportunity_type text not null default 'playlist'
    check (opportunity_type in ('playlist','radio','website')),
  add column if not exists opportunity_target_id uuid,
  add column if not exists campaign_id uuid;

-- Expand ledger event types for weekly resets.
alter table public.credit_ledger drop constraint if exists credit_ledger_entry_type_check;
alter table public.credit_ledger
  add constraint credit_ledger_entry_type_check
  check (entry_type in ('starter_grant','monthly_grant','weekly_reset','submission_spend','refund','admin_adjustment'));

alter table public.credit_ledger
  add column if not exists period_start date;

create unique index if not exists credit_ledger_one_weekly_reset_per_artist
  on public.credit_ledger (artist_id, period_start)
  where entry_type = 'weekly_reset';

create table if not exists public.platform_settings (
  setting_key text primary key,
  setting_value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings(setting_key,setting_value)
values
  ('weekly_credit_policy', '{"credits":40,"timezone":"Africa/Johannesburg","reset_day":"Monday","reset_time":"00:05","rollover":false}'::jsonb),
  ('admin_email', '"kingpinpkaytee@gmail.com"'::jsonb),
  ('marketplace_policy', '{"publish_delay_hours":24,"requires_admin_approval":true,"auto_promote":true,"weekly_top_count":5}'::jsonb)
on conflict (setting_key) do update set setting_value=excluded.setting_value, updated_at=now();

-- Admin identity is assigned only by a database trigger for the configured email
-- after Supabase confirms the email. Do not trust user-editable metadata.
create or replace function public.handle_new_artist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_role text := 'artist';
begin
  if lower(coalesce(new.email,'')) = 'kingpinpkaytee@gmail.com'
     and new.email_confirmed_at is not null then
    assigned_role := 'admin';
  end if;

  insert into public.artist_profiles (id, artist_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'artist_name', ''),
    assigned_role
  )
  on conflict (id) do update set role = excluded.role;

  if assigned_role = 'artist' then
    insert into public.credit_ledger(artist_id, amount, entry_type, description)
    values (new.id, 40, 'starter_grant', '40 free starter credits');
  end if;
  return new;
end;
$$;

-- Also promote an already-existing, verified account matching the configured admin email.
-- This update is performed by the migration owner, not by a client session.
update public.artist_profiles p
set role='admin'
from auth.users u
where p.id=u.id
  and lower(coalesce(u.email,''))='kingpinpkaytee@gmail.com'
  and u.email_confirmed_at is not null;

create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.artist_profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Prevent authenticated artists from assigning themselves privileged roles or
-- changing their own verification state. Trusted database/service operations may.
create or replace function public.guard_artist_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id then
    if new.role is distinct from old.role
       or new.is_verified is distinct from old.is_verified
       or new.verified_at is distinct from old.verified_at
       or new.verification_playlist_followed_at is distinct from old.verification_playlist_followed_at
       or new.spotify_popularity is distinct from old.spotify_popularity
       or new.popularity_score is distinct from old.popularity_score
       or new.popularity_last_synced_at is distinct from old.popularity_last_synced_at then
      raise exception 'Privileged profile fields are managed by Artist Frequency';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_artist_profile_privileges on public.artist_profiles;
create trigger guard_artist_profile_privileges
before update on public.artist_profiles
for each row execute function public.guard_artist_profile_privileges();

-- Curator, platform, radio and blogger directory. Public rows are the source of
-- the truthful public counters; unpublished/unverified entries stay private.
create table if not exists public.opportunity_directories (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('platform','curator','radio_station','blogger','playlist','website')),
  name text not null,
  country text,
  website_url text,
  submission_url text,
  contact_email text,
  genres text[] not null default '{}',
  is_verified boolean not null default false,
  is_active boolean not null default true,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunity_directories_name_length check (char_length(name) between 1 and 160)
);
create index if not exists opportunity_directories_category_idx
  on public.opportunity_directories(category,is_public,is_active);

create table if not exists public.artist_playlist_follows (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artist_profiles(id) on delete cascade,
  playlist_directory_id uuid not null references public.opportunity_directories(id) on delete restrict,
  submitted_proof_url text,
  verified_by uuid references public.artist_profiles(id),
  followed_at timestamptz,
  verified_at timestamptz,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  created_at timestamptz not null default now(),
  unique (artist_id, playlist_directory_id)
);

create table if not exists public.artist_campaigns (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artist_profiles(id) on delete cascade,
  title text not null,
  campaign_goal text not null,
  preferred_channels text[] not null default '{}',
  target_countries text[] not null default '{}',
  target_genres text[] not null default '{}',
  budget_note text not null default 'Free platform credits only',
  campaign_brief text not null default '',
  status text not null default 'draft' check (status in ('draft','submitted','under_review','active','completed','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artist_campaigns_title_length check (char_length(title) between 1 and 140),
  constraint artist_campaigns_brief_length check (char_length(campaign_brief) <= 3000)
);
create index if not exists artist_campaigns_artist_created_idx
  on public.artist_campaigns(artist_id,created_at desc);

create table if not exists public.marketplace_tracks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artist_profiles(id) on delete cascade,
  submission_id uuid references public.artist_submissions(id) on delete set null,
  track_title text not null,
  artist_display_name text not null,
  track_url text not null,
  artwork_url text,
  genre text not null,
  country text,
  description text not null default '',
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending','approved','declined','published','removed')),
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  publish_at timestamptz,
  published_at timestamptz,
  is_promoted boolean not null default false,
  promoted_at timestamptz,
  constraint marketplace_track_url_scheme check (track_url ~* '^https?://'),
  constraint marketplace_tracks_title_length check (char_length(track_title) between 1 and 150)
);
create index if not exists marketplace_tracks_publication_idx
  on public.marketplace_tracks(moderation_status,publish_at);
create index if not exists marketplace_tracks_promoted_idx
  on public.marketplace_tracks(is_promoted,published_at desc);

create table if not exists public.marketplace_weekly_top5 (
  id uuid primary key default gen_random_uuid(),
  marketplace_track_id uuid not null references public.marketplace_tracks(id) on delete cascade,
  week_start date not null,
  rank smallint not null check (rank between 1 and 5),
  selected_by uuid references public.artist_profiles(id),
  created_at timestamptz not null default now(),
  unique (week_start, rank),
  unique (week_start, marketplace_track_id)
);

create table if not exists public.platform_promotion_events (
  id uuid primary key default gen_random_uuid(),
  marketplace_track_id uuid not null references public.marketplace_tracks(id) on delete cascade,
  channel text not null check (channel in ('marketplace_home','weekly_top5','site_feature','external')),
  event_type text not null default 'impression',
  created_at timestamptz not null default now()
);

-- The public marketplace contains only approved tracks whose 24-hour release
-- delay has elapsed and whose status has been advanced by the scheduler.
create or replace view public.public_marketplace_tracks
with (security_invoker = true)
as
select id, track_title, artist_display_name, track_url, artwork_url, genre, country,
       description, published_at, is_promoted
from public.marketplace_tracks
where moderation_status = 'published';

-- Public counters are real counts from published/active records, not hand-entered claims.
create or replace view public.public_platform_statistics
with (security_invoker = true)
as
select
  (select count(*) from public.artist_profiles where profile_visibility='public')::bigint as registered_artists,
  (select count(*) from public.opportunity_directories where category='platform' and is_public and is_active)::bigint as platforms,
  (select count(*) from public.opportunity_directories where category='curator' and is_public and is_active)::bigint as curators,
  (select count(*) from public.opportunity_directories where category='radio_station' and is_public and is_active)::bigint as radio_stations,
  (select count(*) from public.opportunity_directories where category='blogger' and is_public and is_active)::bigint as bloggers;

-- Weekly Top 5 view: admin-selected weekly entries only, no fabricated popularity ranking.
create or replace view public.public_marketplace_top5
with (security_invoker = true)
as
select t.rank, m.id, m.track_title, m.artist_display_name, m.track_url,
       m.artwork_url, m.genre, m.country, m.published_at
from public.marketplace_weekly_top5 t
join public.marketplace_tracks m on m.id=t.marketplace_track_id
where m.moderation_status='published'
  and t.week_start = (
    (now() at time zone 'Africa/Johannesburg')::date
    - ((extract(isodow from (now() at time zone 'Africa/Johannesburg'))::int)-1)
  )
order by t.rank;

alter table public.opportunity_directories enable row level security;
alter table public.artist_playlist_follows enable row level security;
alter table public.artist_campaigns enable row level security;
alter table public.marketplace_tracks enable row level security;
alter table public.marketplace_weekly_top5 enable row level security;
alter table public.platform_promotion_events enable row level security;

-- Public may see only verified, active, published directory entries.
drop policy if exists "Public read published directories" on public.opportunity_directories;
create policy "Public read published directories"
on public.opportunity_directories for select
to anon, authenticated
using (is_public and is_active and is_verified);

drop policy if exists "Artists manage own follows" on public.artist_playlist_follows;
create policy "Artists read own follows"
on public.artist_playlist_follows for select to authenticated
using (auth.uid()=artist_id or public.is_site_admin());
drop policy if exists "Artists request playlist verification" on public.artist_playlist_follows;
create policy "Artists request playlist verification"
on public.artist_playlist_follows for insert to authenticated
with check (auth.uid()=artist_id and status='pending' and verified_at is null);

drop policy if exists "Artists manage own campaigns" on public.artist_campaigns;
create policy "Artists read own campaigns"
on public.artist_campaigns for select to authenticated
using (auth.uid()=artist_id or public.is_site_admin());
drop policy if exists "Artists create own campaigns" on public.artist_campaigns;
create policy "Artists create own campaigns"
on public.artist_campaigns for insert to authenticated
with check (auth.uid()=artist_id and status in ('draft','submitted'));
drop policy if exists "Artists update own draft campaigns" on public.artist_campaigns;
create policy "Artists update own draft campaigns"
on public.artist_campaigns for update to authenticated
using (auth.uid()=artist_id and status='draft')
with check (auth.uid()=artist_id and status='draft');

drop policy if exists "Public read published marketplace tracks" on public.marketplace_tracks;
create policy "Public read published marketplace tracks"
on public.marketplace_tracks for select to anon, authenticated
using (moderation_status='published');
drop policy if exists "Artists read own marketplace tracks" on public.marketplace_tracks;
create policy "Artists read own marketplace tracks"
on public.marketplace_tracks for select to authenticated
using (auth.uid()=artist_id or public.is_site_admin());
drop policy if exists "Artists submit own marketplace tracks" on public.marketplace_tracks;
create policy "Artists submit own marketplace tracks"
on public.marketplace_tracks for insert to authenticated
with check (auth.uid()=artist_id and moderation_status='pending' and approved_at is null and published_at is null and is_promoted=false);

drop policy if exists "Public read weekly top five" on public.marketplace_weekly_top5;
create policy "Public read weekly top five"
on public.marketplace_weekly_top5 for select to anon, authenticated
using (true);

-- No client write policies for directories, verification decisions, weekly Top 5,
-- promotion events, privileged profile fields or credit ledger.

-- Every Monday, 00:05 South African time, set each non-admin artist's balance to
-- exactly 40. The period key prevents duplicate grants in a given reset week.
create or replace function public.run_weekly_credit_reset()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  local_now timestamp := now() at time zone 'Africa/Johannesburg';
  week_monday date := (local_now::date - (extract(isodow from local_now)::int - 1));
  artist record;
  current_balance bigint;
  adjustment integer;
  changed_count integer := 0;
begin
  if auth.uid() is not null and not public.is_site_admin() then
    raise exception 'Not authorized';
  end if;

  for artist in
    select p.id
    from public.artist_profiles p
    where p.role='artist'
  loop
    if exists (
      select 1 from public.credit_ledger l
      where l.artist_id=artist.id
        and l.entry_type='weekly_reset'
        and l.period_start=week_monday
    ) then
      continue;
    end if;

    select coalesce(sum(amount),0) into current_balance
    from public.credit_ledger where artist_id=artist.id;

    adjustment := 40 - current_balance::integer;
    if adjustment <> 0 then
      insert into public.credit_ledger(artist_id,amount,entry_type,period_start,description)
      values (artist.id,adjustment,'weekly_reset',week_monday,'Weekly Monday credit reset to 40 credits');
    else
      -- A zero adjustment is not allowed by the ledger constraint; add a one-step
      -- marker is intentionally avoided. A dedicated reset log table is safer.
      insert into public.weekly_credit_reset_runs(artist_id,period_start,balance_after)
      values (artist.id,week_monday,40)
      on conflict do nothing;
    end if;
    changed_count := changed_count + 1;
  end loop;
  return changed_count;
end;
$$;

create table if not exists public.weekly_credit_reset_runs (
  artist_id uuid not null references public.artist_profiles(id) on delete cascade,
  period_start date not null,
  balance_after integer not null default 40,
  executed_at timestamptz not null default now(),
  primary key (artist_id,period_start)
);

-- Replace the reset function with an idempotent version using the dedicated
-- reset-runs table for both zero and non-zero adjustments.
create or replace function public.run_weekly_credit_reset()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  local_now timestamp := now() at time zone 'Africa/Johannesburg';
  week_monday date := (local_now::date - (extract(isodow from local_now)::int - 1));
  artist record;
  current_balance bigint;
  adjustment integer;
  changed_count integer := 0;
begin
  if auth.uid() is not null and not public.is_site_admin() then
    raise exception 'Not authorized';
  end if;

  for artist in select p.id from public.artist_profiles p where p.role='artist'
  loop
    insert into public.weekly_credit_reset_runs(artist_id,period_start,balance_after)
    values (artist.id,week_monday,40)
    on conflict do nothing;

    if not found then
      continue;
    end if;

    select coalesce(sum(amount),0) into current_balance
    from public.credit_ledger where artist_id=artist.id;

    adjustment := 40 - current_balance::integer;
    if adjustment <> 0 then
      insert into public.credit_ledger(artist_id,amount,entry_type,period_start,description)
      values (artist.id,adjustment,'weekly_reset',week_monday,'Weekly Monday credit reset to 40 credits');
    end if;
    changed_count := changed_count + 1;
  end loop;
  return changed_count;
end;
$$;

-- Admin-only marketplace moderation. Approval schedules publication 24 hours later.
create or replace function public.admin_review_marketplace_track(
  p_track_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_site_admin() then
    raise exception 'Admin access required';
  end if;
  if p_decision not in ('approved','declined') then
    raise exception 'Decision must be approved or declined';
  end if;
  update public.marketplace_tracks
  set moderation_status=p_decision,
      approved_at=case when p_decision='approved' then now() else null end,
      publish_at=case when p_decision='approved' then now()+interval '24 hours' else null end
  where id=p_track_id and moderation_status='pending';
  if not found then
    raise exception 'Pending marketplace track not found';
  end if;
end;
$$;

-- Scheduler calls this function every few minutes. It publishes only tracks
-- that an admin approved at least 24 hours earlier, and promotes them on-site.
create or replace function public.publish_due_marketplace_tracks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare published_count integer;
begin
  if auth.uid() is not null and not public.is_site_admin() then
    raise exception 'Not authorized';
  end if;

  with due as (
    update public.marketplace_tracks
    set moderation_status='published',
        published_at=now(),
        is_promoted=true,
        promoted_at=now()
    where moderation_status='approved' and publish_at <= now()
    returning id
  )
  insert into public.platform_promotion_events(marketplace_track_id,channel,event_type)
  select id,'marketplace_home','auto_publish_promotion' from due;

  get diagnostics published_count = row_count;
  return published_count;
end;
$$;

grant select on public.public_marketplace_tracks to anon, authenticated;
grant select on public.public_marketplace_top5 to anon, authenticated;
grant select on public.public_platform_statistics to anon, authenticated;

-- IMPORTANT: schedule run_weekly_credit_reset() each Monday at 00:05
-- Africa/Johannesburg and publish_due_marketplace_tracks() every 5 minutes
-- using Supabase Cron/Edge Functions after enabling the project's scheduler.
-- Do not expose service-role keys in the browser.
