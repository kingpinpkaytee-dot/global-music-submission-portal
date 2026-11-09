-- Add six individually verified, currently open free Spotify playlist opportunities.
-- Every record has an individual PlaylistDock submission page and a direct Spotify playlist URL.
BEGIN;
WITH opportunities(name, spotify_url, submission_url, curator_name, curator_profile_url, genres, follower_count, approval_rate, response_rate) AS (
  VALUES
  ('RNB Party Hits','https://open.spotify.com/playlist/3bfDasCQMH7tmScZInrkt3','https://playlistdock.com/playlist.php?slug=rnb-party-hits','AURA RAW','https://open.spotify.com/user/31oxrfatrvlsrosbaai5fzaz4hci',ARRAY['Hip Hop & Rap','R&B & Soul']::text[],193,24.30,100.00),
  ('Press Play','https://open.spotify.com/playlist/160dZpTWsEZ55dTnKSr1D7','https://playlistdock.com/playlist.php?slug=press-play-by-cry808-com','agent',NULL,ARRAY['Hip Hop & Rap','Trap']::text[],318,8.00,100.00),
  ('Love at First Mood','https://open.spotify.com/playlist/0n0ydnJ0RG8hcqeIXu1GQ5','https://playlistdock.com/playlist.php?slug=love-at-first-mood','Enqeelscheen_',NULL,ARRAY['Hip Hop & Rap','R&B & Soul','Trap','Drill']::text[],132,51.40,100.00),
  ('Universe Sounds ?? All Genres ? New Music','https://open.spotify.com/playlist/52wDRjZPIr23qmp9OsEyig','https://playlistdock.com/playlist.php?slug=universe-sounds-all-genres-new-music','Nakace7','https://open.spotify.com/artist/79WqBie5aUELM4nIUaNqZs',ARRAY['Hip Hop & Rap','Dance & Electronic','Pop','Alternative & Rock','World Music']::text[],138,35.60,97.00),
  ('Country','https://open.spotify.com/playlist/1PkpcPNSj8mBVOCVi7358c','https://playlistdock.com/playlist.php?slug=country','Ntate Tlhako',NULL,ARRAY['Hip Hop & Rap','R&B & Soul','Afro & Amapiano','House','World Music']::text[],158,0.00,47.00),
  ('New Pop & Indie Pop','https://open.spotify.com/playlist/72lau53Aw6rS77DVSCAeZu','https://playlistdock.com/playlist.php?slug=new-pop-indie-pop-2026','Nakace7','https://open.spotify.com/artist/79WqBie5aUELM4nIUaNqZs',ARRAY['Pop']::text[],260,34.90,99.00)
)
INSERT INTO public.opportunity_directories (
  category,name,website_url,submission_url,curator_name,curator_profile_url,
  genres,is_verified,is_active,is_public,verification_evidence_url,verified_at,
  source_name,source_url,dsp_name,submission_method,accepts_free_submissions,
  activity_status,follower_count,approval_rate,response_rate,first_seen_at,last_checked_at,
  source_evidence_url,data_confidence,is_integrated,accepts_submissions
)
SELECT
  'playlist',o.name,o.spotify_url,o.submission_url,o.curator_name,o.curator_profile_url,
  o.genres,true,true,true,o.submission_url,now(),
  'PlaylistDock',o.submission_url,'Spotify','form',true,
  'active',o.follower_count,o.approval_rate,o.response_rate,now(),now(),
  o.submission_url,'source_confirmed',false,false
FROM opportunities o
WHERE NOT EXISTS (
  SELECT 1 FROM public.opportunity_directories d
  WHERE d.category='playlist' AND lower(d.name)=lower(o.name)
);
COMMIT;
