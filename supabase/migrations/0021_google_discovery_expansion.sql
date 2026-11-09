-- Google Search Engine discovery batch: 6 free Spotify playlist submissions,
-- 5 direct radio submission routes, and 5 global discovery marketplaces/directories.
-- Directory records are sources/opportunities, not inflated counts of their claimed databases.
BEGIN;
WITH new_opportunities(category,name,website_url,submission_url,genres,source_name,source_url,dsp_name,submission_method,accepts_free_submissions,follower_count,approval_rate,response_rate,activity_status,data_confidence) AS (
  VALUES
  ('playlist','A las 2 am','https://open.spotify.com/playlist/2OUUjU1AmIw5OoDHk47DAi','https://playlistdock.com/playlist.php?slug=a-las-2-am',ARRAY['Latin']::text[],'PlaylistDock','https://playlistdock.com/playlist.php?slug=a-las-2-am','Spotify','form',true,2000,32.2,100.0,'active','source_confirmed'),
  ('playlist','Selena Gomez - Piano Instrumental','https://open.spotify.com/playlist/2sQZuhnkzDu6C1yFti97PK','https://playlistdock.com/playlist.php?slug=selena-gomez-piano-instrumental',ARRAY['Lo-Fi & Chill']::text[],'PlaylistDock','https://playlistdock.com/playlist.php?slug=selena-gomez-piano-instrumental','Spotify','form',true,300,0.0,0.0,'active','source_confirmed'),
  ('playlist','Eletrônicas - Baladas - Anos 90 e 2000','https://open.spotify.com/playlist/2j5kJAK4gCAFGl6KH9W0le','https://playlistdock.com/playlist.php?slug=eletr-nicas-baladas-anos-90-e-2000',ARRAY['Dance & Electronic']::text[],'PlaylistDock','https://playlistdock.com/playlist.php?slug=eletr-nicas-baladas-anos-90-e-2000','Spotify','form',true,474,0.0,0.0,'active','source_confirmed'),
  ('playlist','Darkroom Horizons','https://open.spotify.com/playlist/4VpuRjqBMYiKp7yGz9pfI1','https://playlistdock.com/playlist.php?slug=darkroom-horizons',ARRAY['Dance & Electronic']::text[],'PlaylistDock','https://playlistdock.com/playlist.php?slug=darkroom-horizons','Spotify','form',true,1400,0.6,100.0,'active','source_confirmed'),
  ('playlist','Pigeon Opinion','https://open.spotify.com/playlist/79LA21CTULnO2ygd6d9h8Z','https://playlistdock.com/playlist.php?slug=pigeon-opinion',ARRAY['Dancehall','House','Pop','Country & Folk']::text[],'PlaylistDock','https://playlistdock.com/playlist.php?slug=pigeon-opinion','Spotify','form',true,1600,51.1,49.0,'active','source_confirmed'),
  ('playlist','Christmas Vibes 🎄','https://open.spotify.com/playlist/7j11rOefHvIqS2BZM59Y62','https://playlistdock.com/playlist.php?slug=christmas-vibes',ARRAY['World Music']::text[],'PlaylistDock','https://playlistdock.com/playlist.php?slug=christmas-vibes','Spotify','form',true,86,32.6,100.0,'active','source_confirmed'),
  ('radio_station','Radio NFM','https://www.radionfm.co.za/','https://www.radionfm.co.za/music-submissions.php',ARRAY['All genres','Independent music']::text[],'Google Search','https://www.radionfm.co.za/music-submissions.php',NULL,'form',true,NULL,NULL,NULL,'active','source_confirmed'),
  ('radio_station','Radio X5 Stereo','https://radiox5.co.za/','https://radiox5.co.za/music-submissions/',ARRAY['All genres','Independent music']::text[],'Google Search','https://radiox5.co.za/music-submissions/',NULL,'form',true,NULL,NULL,NULL,'active','source_confirmed'),
  ('radio_station','Radio 321','https://radio321.fm/','https://radio321.fm/submit.php',ARRAY['Original independent music']::text[],'Google Search','https://radio321.fm/submit.php',NULL,'form',true,NULL,NULL,NULL,'active','source_confirmed'),
  ('radio_station','Share Radio','https://shareonline.co.za/','https://shareonline.co.za/share-radio-song-submission/',ARRAY['All genres','Independent music']::text[],'Google Search','https://shareonline.co.za/share-radio-song-submission/',NULL,'form',true,NULL,NULL,NULL,'active','source_confirmed'),
  ('radio_station','Fully Open Radio','https://fullyopenrecords.com/','https://fullyopenrecords.com/submit-music-to-radio',ARRAY['Original independent music']::text[],'Google Search','https://fullyopenrecords.com/submit-music-to-radio',NULL,'portal',true,NULL,NULL,NULL,'active','source_confirmed'),
  ('platform','SubmitFinder','https://www.submitfinder.com/','https://www.submitfinder.com/',ARRAY['Playlists','Radio','Blogs','Podcasts','Magazines','YouTube']::text[],'Google Search','https://www.submitfinder.com/','Multi-platform','portal',true,NULL,NULL,NULL,'active','source_confirmed'),
  ('platform','Delaynote Playlist Directory','https://delaynote.com/','https://delaynote.com/playlists',ARRAY['Spotify playlists','Multi-genre']::text[],'Google Search','https://delaynote.com/playlists','Spotify','unknown',false,NULL,NULL,NULL,'active','source_confirmed'),
  ('platform','Playlist Panda','https://playlistpanda.com/','https://playlistpanda.com/spotify-playlists',ARRAY['Playlists','Multi-genre']::text[],'Google Search','https://playlistpanda.com/spotify-playlists','Spotify','portal',false,NULL,NULL,NULL,'active','source_confirmed'),
  ('platform','Audiartist','https://audiartist.com/','https://music-submission.audiartist.com/',ARRAY['Playlists','Radio','Curators']::text[],'Google Search','https://music-submission.audiartist.com/','Spotify','portal',true,NULL,NULL,NULL,'active','source_confirmed'),
  ('platform','ArtistLauncher','https://app.artistlauncher.com/','https://app.artistlauncher.com/',ARRAY['Playlists','Radio','Blogs','Shows','Curators']::text[],'Google Search','https://app.artistlauncher.com/','Multi-platform','portal',true,NULL,NULL,NULL,'active','source_confirmed')
)
INSERT INTO public.opportunity_directories (
 category,name,website_url,submission_url,genres,is_verified,is_active,is_public,
 verification_evidence_url,verified_at,source_name,source_url,dsp_name,submission_method,
 accepts_free_submissions,activity_status,follower_count,approval_rate,response_rate,
 first_seen_at,last_checked_at,source_evidence_url,data_confidence,is_integrated,accepts_submissions
)
SELECT o.category,o.name,o.website_url,o.submission_url,o.genres,true,true,true,
 o.source_url,now(),o.source_name,o.source_url,o.dsp_name,o.submission_method,
 o.accepts_free_submissions,o.activity_status,o.follower_count,o.approval_rate,o.response_rate,
 now(),now(),o.source_url,o.data_confidence,false,false
FROM new_opportunities o
WHERE NOT EXISTS (
 SELECT 1 FROM public.opportunity_directories d
 WHERE d.category=o.category AND lower(d.name)=lower(o.name)
);
COMMIT;
