-- Google Search research batch captured 10 November 2026.
-- All entries are PRIVATE pending candidates; no public directory rows or
-- delivery permissions are created by this migration.
BEGIN;

INSERT INTO public.opportunity_discovery_candidates (
 category,name,country,dsp_name,genres,website_url,submission_url,contact_email,
 submission_method,accepts_free_submissions,activity_status,source_name,source_url,
 evidence_url,first_seen_at,last_checked_at,review_status
)
SELECT v.category,v.name,v.country,v.dsp_name,v.genres,v.website_url,v.submission_url,
 v.contact_email,v.submission_method,v.accepts_free_submissions,'active',
 'Google Search',v.source_url,v.source_url,now(),now(),'pending'
FROM (VALUES
 ('radio_station','Radio NFM','South Africa',NULL::text,ARRAY['Independent music','All genres']::text[],
  'https://www.radionfm.co.za/','https://www.radionfm.co.za/music-submissions.php',NULL::text,'form',false,
  'https://www.radionfm.co.za/music-submissions.php'),
 ('radio_station','Stellar Radio Network — Music Department','South Africa',NULL::text,ARRAY['Radio network','Artist submissions']::text[],
  'https://stellarmediagroup.co.za/','https://stellarmediagroup.co.za/musicsubmissions/','music@stellar-radio.co.za','email',false,
  'https://stellarmediagroup.co.za/musicsubmissions/'),
 ('radio_station','HOT365 Radio','United States',NULL::text,ARRAY['Hip-Hop','R&B','House','Afrobeats','Reggae','Pop']::text[],
  'https://hot365media.com/','https://hot365media.com/submissions','submissions@hot365radio.com','email',false,
  'https://hot365media.com/submissions'),
 ('radio_station','Radio 2000','South Africa',NULL::text,ARRAY['Adult Contemporary']::text[],
  'https://www.radio2000.co.za/','https://www.radio2000.co.za/radio2000/submit-music/','playlist@radio2000.co.za','email',false,
  'https://www.radio2000.co.za/radio2000/submit-music/'),
 ('radio_station','Pheli FM','South Africa',NULL::text,ARRAY['Adult Contemporary']::text[],
  'https://phelifm.co.za/','https://phelifm.co.za/submit-your-work/','music@phelifm.co.za','email',false,
  'https://phelifm.co.za/submit-your-work/'),
 ('radio_station','Bay FM 107.9','South Africa',NULL::text,ARRAY['Local music','Radio edits']::text[],
  'https://app.bayfm.co.za/','https://app.bayfm.co.za/','music@bayfm.co.za','email',false,
  'https://app.bayfm.co.za/'),
 ('radio_station','Wild Dogs Radio','United States',NULL::text,ARRAY['All genres','Independent music']::text[],
  'https://wilddogsradio.com/','https://wilddogsradio.com/music-submissions/','office@wilddogsradio.com','email',true,
  'https://wilddogsradio.com/music-submissions/'),
 ('radio_station','Bogart Radio','South Africa',NULL::text,ARRAY['Independent music']::text[],
  'https://bogartradio.co.za/','https://bogartradio.co.za/submissions/',NULL::text,'form',false,
  'https://bogartradio.co.za/submissions/'),
 ('radio_station','Capital City Radio','South Africa',NULL::text,ARRAY['Emerging South African artists']::text[],
  'https://www.capitalcityradio.co.za/','https://www.capitalcityradio.co.za/','music@capitalcityradio.co.za','email',false,
  'https://www.capitalcityradio.co.za/'),
 ('curator','QRTR Playlists','Global','Spotify',ARRAY['Mood-based playlists','Multi-genre']::text[],
  'https://www.qrtrplaylists.com/','https://www.qrtrplaylists.com/pitch-your-music-for-free',NULL::text,'form',true,
  'https://www.qrtrplaylists.com/pitch-your-music-for-free'),
 ('curator','Shancy — SubmitLink','Global','Spotify',ARRAY['Deep House','Afro House','Melodic House']::text[],
  'https://www.submitlink.io/c/shancylabel','https://www.submitlink.io/c/shancylabel',NULL::text,'portal',true,
  'https://www.submitlink.io/c/shancylabel'),
 ('platform','PlaylistDock — Afro & Amapiano submissions','Global','Spotify',ARRAY['Afro House','Amapiano','Afrobeats']::text[],
  'https://playlistdock.com/','https://playlistdock.com/genre.php?slug=afro-amapiano',NULL::text,'portal',true,
  'https://playlistdock.com/genre.php?slug=afro-amapiano'),
 ('platform','PlaylistDock — House submissions','Global','Spotify',ARRAY['House','Deep House']::text[],
  'https://playlistdock.com/','https://playlistdock.com/genre.php?slug=house',NULL::text,'portal',true,
  'https://playlistdock.com/genre.php?slug=house'),
 ('platform','Soundplate — Amapiano playlist submissions','Global','Spotify',ARRAY['Amapiano','Afro House','Afrobeats']::text[],
  'https://soundplate.com/','https://soundplate.com/new-spotify-playlists1/amapiano/',NULL::text,'portal',true,
  'https://soundplate.com/new-spotify-playlists1/amapiano/'),
 ('platform','IndieMono — Free playlist submission','Global','Spotify',ARRAY['Multi-genre']::text[],
  'https://indiemono.com/','https://indiemono.com/music-submit/',NULL::text,'form',true,
  'https://indiemono.com/music-submit/'),
 ('platform','Audiartist — Music Submission','Global','Spotify',ARRAY['Playlists','Radio','Curators']::text[],
  'https://www.audiartist.com/','https://music-submission.audiartist.com/',NULL::text,'portal',true,
  'https://music-submission.audiartist.com/'),
 ('platform','SubmitFinder — Music opportunity directory','Global',NULL::text,ARRAY['Playlists','Radio','Blogs','Podcasts','Magazines']::text[],
  'https://www.submitfinder.com/','https://www.submitfinder.com/',NULL::text,'portal',true,
  'https://www.submitfinder.com/'),
 ('platform','NXTNOW Music — Pitch List','Global',NULL::text,ARRAY['Blogs','Playlists','Sync','Labels','Radio']::text[],
  'https://nxtnowmusic.com/','https://nxtnowmusic.com/pitchlist',NULL::text,'portal',false,
  'https://nxtnowmusic.com/pitchlist'),
 ('contact','Stellar Radio Network — Music submission contact','South Africa',NULL::text,ARRAY['Radio submissions']::text[],
  'https://stellarmediagroup.co.za/','https://stellarmediagroup.co.za/musicsubmissions/','music@stellar-radio.co.za','email',false,
  'https://stellarmediagroup.co.za/musicsubmissions/'),
 ('contact','HOT365 Radio — Music submissions contact','United States',NULL::text,ARRAY['Radio submissions']::text[],
  'https://hot365media.com/','https://hot365media.com/submissions','submissions@hot365radio.com','email',false,
  'https://hot365media.com/submissions'),
 ('contact','Radio 2000 — Playlist submissions contact','South Africa',NULL::text,ARRAY['Radio submissions']::text[],
  'https://www.radio2000.co.za/','https://www.radio2000.co.za/radio2000/submit-music/','playlist@radio2000.co.za','email',false,
  'https://www.radio2000.co.za/radio2000/submit-music/'),
 ('contact','Pheli FM — Music submissions contact','South Africa',NULL::text,ARRAY['Radio submissions']::text[],
  'https://phelifm.co.za/','https://phelifm.co.za/submit-your-work/','music@phelifm.co.za','email',false,
  'https://phelifm.co.za/submit-your-work/'),
 ('contact','Bay FM — Music submissions contact','South Africa',NULL::text,ARRAY['Radio submissions']::text[],
  'https://app.bayfm.co.za/','https://app.bayfm.co.za/','music@bayfm.co.za','email',false,
  'https://app.bayfm.co.za/'),
 ('contact','Wild Dogs Radio — Music submissions contact','United States',NULL::text,ARRAY['Radio submissions']::text[],
  'https://wilddogsradio.com/','https://wilddogsradio.com/music-submissions/','office@wilddogsradio.com','email',true,
  'https://wilddogsradio.com/music-submissions/')
) AS v(category,name,country,dsp_name,genres,website_url,submission_url,contact_email,submission_method,accepts_free_submissions,source_url)
WHERE NOT EXISTS (
 SELECT 1 FROM public.opportunity_discovery_candidates c
 WHERE c.category=v.category AND lower(c.source_url)=lower(v.source_url)
   AND lower(c.name)=lower(v.name)
);

COMMIT;
