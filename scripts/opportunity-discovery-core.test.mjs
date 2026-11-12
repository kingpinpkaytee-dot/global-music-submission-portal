import test from "node:test";
import assert from "node:assert/strict";
import {
 extractSubmissionRoute,extractPlaylistName,parseGoogleNewsRss,registrableDomain,isSafePublicHttpUrl,qualifiesPlaylist
} from "./opportunity-discovery-core.mjs";

test("extracts a music submission form action",()=>{
 const route=extractSubmissionRoute('<form action="/send-demo" method="post"><label>Submit your music track</label><input name="artist"></form>',"https://curator.example/profile");
 assert.deepEqual(route,{url:"https://curator.example/send-demo",method:"form"});
});
test("extracts a clearly labelled external submission portal",()=>{
 const route=extractSubmissionRoute('<a href="https://forms.example/music-pitch">Submit your music</a>',"https://curator.example");
 assert.deepEqual(route,{url:"https://forms.example/music-pitch",method:"portal"});
});
test("does not mistake a newsletter form for a submission route",()=>{
 assert.equal(extractSubmissionRoute('<form action="/subscribe"><label>Subscribe to newsletter</label></form>',"https://curator.example"),null);
});
test("resolves registrable domains including common multi-label suffixes",()=>{
 assert.equal(registrableDomain("https://www.example.co.za/music"),"example.co.za");
 assert.equal(registrableDomain("https://blog.example.com"),"example.com");
 assert.equal(registrableDomain("https://curator.example.org.uk"),"example.org.uk");
});
test("blocks unsafe, private and non-http destinations",()=>{
 for(const url of ["javascript:alert(1)","file:///etc/passwd","http://localhost/admin","http://127.0.0.1/","http://192.168.1.1/","http://169.254.169.254/latest/meta-data","https://host.local/"])
  assert.equal(isSafePublicHttpUrl(url),false,url);
 assert.equal(isSafePublicHttpUrl("https://soundplate.com/submit"),true);
});
test("strict playlist gates accept boundary values and all genres",()=>{
 const result=qualifiesPlaylist({
  playlistUrl:"https://open.spotify.com/playlist/5yzND7XsDIzBYIBKu42LJw",
  followerCount:101,responseRate:0.5,activityStatus:"active",
  submissionUrl:"https://curator.example/submit"
 });
 assert.equal(result.ok,true);
 assert.equal(result.score,100);
});
test("strict playlist gates reject 100 followers, missing activity, missing response rate and missing route",()=>{
 const result=qualifiesPlaylist({
  playlistUrl:"https://open.spotify.com/playlist/5yzND7XsDIzBYIBKu42LJw",
  followerCount:100,responseRate:null,activityStatus:"unknown",submissionUrl:null
 });
 assert.equal(result.ok,false);
 assert.equal(result.failures.length,4);
});
test("strict playlist gates reject response rates outside 0.5-100",()=>{
 for(const rate of [0.49,100.01])
  assert.equal(qualifiesPlaylist({playlistUrl:"https://open.spotify.com/playlist/abc123",followerCount:101,responseRate:rate,activityStatus:"active",submissionUrl:"https://curator.example/submit"}).ok,false);
});

test("extracts the playlist name from the anchor for its Spotify URL",()=>{
 assert.equal(extractPlaylistName('<a href="https://open.spotify.com/playlist/abc123">Afro House Dancin</a>',"https://open.spotify.com/playlist/abc123","Submit your music"),"Afro House Dancin");
});
test("does not use a generic page heading as a playlist name",()=>{
 assert.equal(extractPlaylistName("<h1>Submit your music</h1>","https://open.spotify.com/playlist/abc123","Submit your music"),"");
});

test("rejects unrelated pitch links without music context",()=>{
 assert.equal(extractSubmissionRoute('<a href="/pitch">Pitch us</a>',"https://curator.example"),null);
});

test("rejects generic listen-on-Spotify labels as playlist names",()=>{
 assert.equal(extractPlaylistName('<a href="https://open.spotify.com/playlist/abc123">Listen on Spotify</a>',"https://open.spotify.com/playlist/abc123","Listen on Spotify"),"");
});

test("parses safe Google News RSS results, including resolvable wrappers",()=>{
 const parsed=parseGoogleNewsRss(\`<?xml version="1.0"?><rss><channel>
  <item><title><![CDATA[Afro House playlist curator opportunity]]></title>
   <link>https://publisher.example/playlist</link>
   <description><![CDATA[Submit your music]]></description>
   <pubDate>Thu, 12 Nov 2026 00:00:00 GMT</pubDate></item>
  <item><title>Unsafe destination</title><link>http://127.0.0.1/private</link><description>blocked</description></item>
  <item><title>Google News wrapper</title><link>https://news.google.com/rss/articles/abc123</link><description>resolve before inspection</description></item>
 </channel></rss>\`);
 assert.equal(parsed.length,2);
 assert.equal(parsed[0].title,"Afro House playlist curator opportunity");
 assert.equal(parsed[0].url,"https://publisher.example/playlist");
 assert.equal(parsed[1].url,"https://news.google.com/rss/articles/abc123");
});
test("does not substitute a curator page title for a missing playlist label",()=>{
 assert.equal(extractPlaylistName("<h1>Curator Platform</h1>","https://open.spotify.com/playlist/abc123","Curator Platform"),"");
});
