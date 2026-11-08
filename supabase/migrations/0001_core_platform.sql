-- Artist Frequency core platform schema
-- Target: Supabase (PostgreSQL + Supabase Auth)
-- Apply through the Supabase SQL Editor or migration tooling.
-- Credit reset cadence and per-submission costs remain configurable product decisions.

create extension if not exists pgcrypto;

create table if not exists public.artist_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  artist_name text not null default '',
  country text,
  biography text not null default '',
  website_url text,
  avatar_url text,
  social_links jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artist_profiles_artist_name_length check (char_length(artist_name) <= 100),
  constraint artist_profiles_biography_length check (char_length(biography) <= 2000),
  constraint artist_profiles_social_links_object check (jsonb_typeof(social_links) = 'object')
);

create table if not exists public.artist_submissions (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artist_profiles(id) on delete cascade,
  track_title text not null,
  artist_name text not null,
  track_url text not null,
  genre text not null,
  subgenre text,
  country text not null,
  release_date date,
  notes text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  curator_feedback text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artist_submissions_title_length check (char_length(track_title) between 1 and 150),
  constraint artist_submissions_artist_length check (char_length(artist_name) between 1 and 100),
  constraint artist_submissions_notes_length check (char_length(notes) <= 1000),
  constraint artist_submissions_feedback_length check (curator_feedback is null or char_length(curator_feedback) <= 2000),
  constraint artist_submissions_track_url_scheme check (track_url ~* '^https?://')
);

create index if not exists artist_submissions_artist_created_idx
  on public.artist_submissions (artist_id, created_at desc);
create index if not exists artist_submissions_status_created_idx
  on public.artist_submissions (status, created_at desc);

-- Signed ledger: positive values add credits; negative values consume credits.
-- All writes must come from trusted server-side code/service role, never the browser.
create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artist_profiles(id) on delete cascade,
  amount integer not null check (amount <> 0),
  entry_type text not null check (entry_type in ('starter_grant', 'monthly_grant', 'submission_spend', 'refund', 'admin_adjustment')),
  reference_id uuid,
  description text not null default '',
  created_at timestamptz not null default now(),
  constraint credit_ledger_description_length check (char_length(description) <= 500)
);

create index if not exists credit_ledger_artist_created_idx
  on public.credit_ledger (artist_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists artist_profiles_set_updated_at on public.artist_profiles;
create trigger artist_profiles_set_updated_at
before update on public.artist_profiles
for each row execute function public.set_updated_at();

drop trigger if exists artist_submissions_set_updated_at on public.artist_submissions;
create trigger artist_submissions_set_updated_at
before update on public.artist_submissions
for each row execute function public.set_updated_at();

-- Create a basic artist profile whenever Supabase Auth creates a user.
create or replace function public.handle_new_artist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.artist_profiles (id, artist_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'artist_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_artist on auth.users;
create trigger on_auth_user_created_artist
after insert on auth.users
for each row execute procedure public.handle_new_artist();

alter table public.artist_profiles enable row level security;
alter table public.artist_submissions enable row level security;
alter table public.credit_ledger enable row level security;

-- Artists can read and update only their own profile.
drop policy if exists "Artists read own profile" on public.artist_profiles;
create policy "Artists read own profile"
on public.artist_profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Artists update own profile" on public.artist_profiles;
create policy "Artists update own profile"
on public.artist_profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Artists can create and read their own submissions.
-- They cannot change moderation status or curator feedback directly.
drop policy if exists "Artists read own submissions" on public.artist_submissions;
create policy "Artists read own submissions"
on public.artist_submissions for select
to authenticated
using (auth.uid() = artist_id);

drop policy if exists "Artists create own submissions" on public.artist_submissions;
create policy "Artists create own submissions"
on public.artist_submissions for insert
to authenticated
with check (
  auth.uid() = artist_id
  and status = 'pending'
  and curator_feedback is null
  and reviewed_at is null
);

-- No artist-facing UPDATE or DELETE policy is intentionally provided.
-- Moderation changes must be performed by trusted server-side staff workflows.

-- Artists may read their own credit history/balance inputs.
-- No client-side insert/update/delete policies are provided.
drop policy if exists "Artists read own credit ledger" on public.credit_ledger;
create policy "Artists read own credit ledger"
on public.credit_ledger for select
to authenticated
using (auth.uid() = artist_id);

-- Convenience view: current balance is calculated from the immutable ledger.
create or replace view public.artist_credit_balances
with (security_invoker = true)
as
select
  artist_id,
  coalesce(sum(amount), 0)::bigint as credit_balance
from public.credit_ledger
group by artist_id;

grant select on public.artist_credit_balances to authenticated;

-- IMPORTANT:
-- 1) Do not expose the Supabase service-role key in frontend code.
-- 2) Apply server-side validation, rate limits, URL/domain checks and abuse controls.
-- 3) Define the precise free-credit reset schedule before scheduling grants.
-- 4) Use a trusted Edge Function/Backend transaction to validate balance,
--    create the submission and write the corresponding negative ledger entry atomically.
