-- Admin visibility and campaign submission policy correction.
-- Apply after 0004_submission_credits_and_verification.sql.

drop policy if exists "Artists update own draft campaigns" on public.artist_campaigns;
create policy "Artists update own draft campaigns"
on public.artist_campaigns for update to authenticated
using (auth.uid()=artist_id and status='draft')
with check (auth.uid()=artist_id and status in ('draft','submitted'));

drop policy if exists "Admins read all artist profiles" on public.artist_profiles;
create policy "Admins read all artist profiles"
on public.artist_profiles for select to authenticated
using (public.is_site_admin());

-- Admin can read all playlist-follow verification requests.
drop policy if exists "Admins read all playlist follow requests" on public.artist_playlist_follows;
create policy "Admins read all playlist follow requests"
on public.artist_playlist_follows for select to authenticated
using (public.is_site_admin());
