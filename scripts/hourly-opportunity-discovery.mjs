import { extractSubmissionRoute, hostnameOf, registrableDomain, isSafePublicHttpUrl, qualifiesPlaylist } from "./opportunity-discovery-core.mjs";

// Global music-opportunity discovery for Artist Frequency.
// Public playlist discovery target: 18,000+ unique opportunities over time.
// The target is a research backlog goal, NOT a claim about Spotify's playlist count.
// Auto-publication remains gated by fresh publisher-page evidence AND independent
// second-source corroboration. Published listings never enable in-platform submissions.
const SUPABASE_URL=process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const BRAVE_SEARCH_API_KEY=process.env.BRAVE_SEARCH_API_KEY;
if(![SUPABASE_URL,SERVICE_ROLE_KEY,BRAVE_SEARCH_API_KEY].every(Boolean)) throw new Error("Missing required Supabase or Brave Search configuration.");
// Supabase's newer sb_secret_* keys are API keys, not JWTs: send them only
// in apikey. Legacy service_role keys are JWTs and may also be sent as Bearer.
const isNewSecretKey=SERVICE_ROLE_KEY.startsWith("sb_secret_");
if(SERVICE_ROLE_KEY.startsWith("sb_publishable_")||SERVICE_ROLE_KEY.startsWith("sb_anon_")) throw new Error("SUPABASE_SERVICE_ROLE_KEY must be a server-side Supabase secret key (sb_secret_*) or legacy service_role JWT, not a publishable/anon key.");
if(!isNewSecretKey&&SERVICE_ROLE_KEY.split(".").length!==3) throw new Error("SUPABASE_SERVICE_ROLE_KEY must be an sb_secret_* key or a legacy three-part service_role JWT.");
const headers={apikey:SERVICE_ROLE_KEY,...(isNewSecretKey?{}:{Authorization:"Bearer "+SERVICE_ROLE_KEY}),"Content-Type":"application/json"};
// Exact-phrase searches avoid dictionary matches on the word "submit".
const playlistRegions=[
 "South Africa","Nigeria","Ghana","Kenya","Tanzania","Uganda",
 "United Kingdom","United States","Canada","Brazil","Mexico","Argentina",
 "Germany","France","Netherlands","Sweden","Spain","Italy",
 "India","Japan","South Korea","Australia","New Zealand",
 "Jamaica","Trinidad and Tobago","France","Portugal","Poland"
];
// Playlist-only discovery: all genres, worldwide, across major DSPs and curator platforms.
// Qualification: strictly more than 100 followers, explicitly active, response rate 0.5%-100%.
const playlistQueries=playlistRegions.slice(0,18).map(region=>({
 category:"playlist",region,
 q:`("music playlist" OR "Spotify playlist" OR "Apple Music playlist" OR "YouTube playlist") ("followers" OR "response rate") "${region}" active curator -jobs -definition`
}));
const platformPlaylistQueries=[
 {category:"playlist",dsp:"Spotify",q:'site:open.spotify.com/playlist "playlist curator" ("submit music" OR "submission")'},
 {category:"playlist",dsp:"YouTube",q:'site:youtube.com/playlist ("music curator" OR "submit music" OR "playlist submission")'},
 {category:"playlist",dsp:"YouTube Music",q:'site:music.youtube.com/playlist ("curator" OR "submit music" OR "playlist submission")'},
 {category:"playlist",dsp:"Apple Music",q:'site:music.apple.com "playlist" ("submit music" OR "curator" OR "music submission")'},
 {category:"playlist",dsp:"Deezer",q:'site:deezer.com/playlist ("curator" OR "submit music" OR "playlist submission")'},
 {category:"playlist",dsp:"Tidal",q:'site:tidal.com/browse/playlist ("curator" OR "submit music" OR "playlist submission")'},
 {category:"playlist",dsp:"SubmitHub",q:'site:submithub.com curator playlist "response rate" followers active'},
 {category:"playlist",dsp:"Pitchplaylists",q:'site:pitchplaylists.com playlist curator followers active response'},
 {category:"playlist",dsp:"Daily Playlists",q:'site:dailyplaylists.com playlist curator followers active response rate'},
 {category:"playlist",dsp:"Groover",q:'site:groover.co playlist curator "response rate" active followers'},
 {category:"playlist",dsp:"SubmitLink",q:'site:submitlink.io playlist curator followers response rate active'},
 {category:"playlist",dsp:"PlaylistSupply",q:'playlist curator database "response rate" followers active'},
 {category:"playlist",dsp:"Global playlist curators",q:'music playlist curator "response rate" "followers" active submission'},
 {category:"playlist",dsp:"SubmitLink profiles",q:'site:submitlink.io/c/ "followers" "response rate" playlist curator'},
 {category:"playlist",dsp:"SubmitLink profiles",q:'site:submitlink.io/c/ "Spotify playlist" curator followers'},
 {category:"playlist",dsp:"SubmitHub curator profiles",q:'site:submithub.com/curators "response rate" playlist'},
 {category:"playlist",dsp:"SubmitHub curator profiles",q:'site:submithub.com "curator" "responds to" playlist music'},
 {category:"playlist",dsp:"Groover curator profiles",q:'site:groover.co "response rate" playlist curator'},
 {category:"playlist",dsp:"Groover curator profiles",q:'site:groover.co "active" "playlist" curator music'},
 {category:"playlist",dsp:"Daily Playlists curator profiles",q:'site:dailyplaylists.com curator playlist followers active'},
 {category:"playlist",dsp:"Pitchplaylists curator profiles",q:'site:pitchplaylists.com playlist curator "followers"'},
 {category:"playlist",dsp:"Soundplate playlist submissions",q:'site:soundplate.com playlist submit music curator Spotify playlist'},
 {category:"playlist",dsp:"Playlist curator profiles",q:'"response rate" "Spotify playlist" curator "followers"'},
 {category:"playlist",dsp:"Playlist curator profiles",q:'"responds to" "playlist submissions" Spotify curator'},
 {category:"playlist",dsp:"Playlist curator profiles",q:'"last active" playlist curator music submission followers'},
 {category:"playlist",dsp:"Playlist curator profiles",q:'"active curator" "response rate" music playlist submit'},
 {category:"playlist",dsp:"SubmitLink curator profiles",q:'site:submitlink.io/c/ "Spotify" "followers" ("response rate" OR "responds to")'},
 {category:"playlist",dsp:"SubmitLink curator profiles",q:'site:submitlink.io/c/ "followers" "active" playlist'},
 {category:"playlist",dsp:"SubmitLink curator profiles",q:'site:submitlink.io/c/ "open.spotify.com/playlist" curator'},
 {category:"playlist",dsp:"SubmitHub curator profiles",q:'site:submithub.com/curators "response rate" "followers" Spotify'},
 {category:"playlist",dsp:"SubmitHub curator profiles",q:'site:submithub.com "responds to" "playlist" "Spotify" curator'},
 {category:"playlist",dsp:"Groover curator profiles",q:'site:groover.co "response rate" "followers" playlist curator'},
 {category:"playlist",dsp:"Daily Playlists curator profiles",q:'site:dailyplaylists.com "Spotify playlist" "curator" "followers"'},
 {category:"playlist",dsp:"Pitchplaylists curator profiles",q:'site:pitchplaylists.com "Spotify playlist" "followers" curator'}
];
const queries=[...playlistQueries,...platformPlaylistQueries];
const queryRotationIndex=Math.floor(Date.now()/3600000)%queries.length;
const searchesPerRun=Math.max(1,Math.min(2,Number(process.env.DISCOVERY_SEARCHES_PER_RUN||1)));
const activeQueries=Array.from({length:searchesPerRun},(_,i)=>queries[(queryRotationIndex+i)%queries.length]);
const now=()=>new Date().toISOString();
async function request(url,options={},label="request"){
 const res=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
 const body=await res.text();
 if(!res.ok) throw new Error(label+" "+res.status+": "+body.slice(0,400));
 return body?JSON.parse(body):null;
}
async function rest(path,options={}){
 return request(SUPABASE_URL+"/rest/v1/"+path,{...options,headers:{...headers,...options.headers}},"Supabase");
}
function decodeHtml(s){
 return String(s||"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
}
function stripTags(s){return decodeHtml(String(s||"").replace(/<[^>]*>/g," ")).replace(/\s+/g," ").trim();}
async function search(q){
 const u=new URL("https://api.search.brave.com/res/v1/web/search");
 u.searchParams.set("q",q);u.searchParams.set("count","20");
 u.searchParams.set("safesearch","strict");u.searchParams.set("spellcheck","false");u.searchParams.set("extra_snippets","true");
 let lastError=null;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const res=await fetch(u,{headers:{"Accept":"application/json","X-Subscription-Token":BRAVE_SEARCH_API_KEY,"User-Agent":"ArtistFrequencyOpportunityDiscovery/2.0"},signal:AbortSignal.timeout(18000)});
   const body=await res.text();
   if(!res.ok){const error=new Error("Brave Search API HTTP "+res.status+": "+body.slice(0,300));if(res.status===429||res.status>=500){lastError=error;await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));continue;}throw error;}
   const data=JSON.parse(body);
   const items=(data.web?.results||[]).map(hit=>({title:String(hit.title||""),link:String(hit.url||""),snippet:String([hit.description,...(hit.extra_snippets||[])].filter(Boolean).join(" ")),provider:"Brave Search API",publisherUrl:null,pageAge:hit.page_age||null})).filter(hit=>isSafePublicHttpUrl(hit.link));
   return {items,providerStats:{"Brave Search API":{count:items.length,error:null}}};
  }catch(e){lastError=e;if(attempt===2)break;}
 }
 throw lastError||new Error("Brave Search API failed without a response");
}
async function readLimitedText(response,maxBytes=250000){
 const reader=response.body?.getReader();if(!reader)return "";
 const decoder=new TextDecoder();let output="",total=0;
 try{while(total<maxBytes){const {done,value}=await reader.read();if(done)break;const remaining=maxBytes-total;const chunk=value.byteLength>remaining?value.slice(0,remaining):value;output+=decoder.decode(chunk,{stream:true});total+=chunk.byteLength;if(value.byteLength>remaining)break;}}
 finally{try{await reader.cancel();}catch{}}
 return output+decoder.decode();
}
async function inspect(url){
 let current=String(url||"");
 for(let hop=0;hop<=5;hop++){
  if(!isSafePublicHttpUrl(current))return {ok:false,reason:"Unsafe or non-public URL blocked"};
  try{
   const res=await fetch(current,{redirect:"manual",signal:AbortSignal.timeout(12000),headers:{"User-Agent":"ArtistFrequencyOpportunityResearch/2.0","Accept":"text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5"}});
   if([301,302,303,307,308].includes(res.status)){
    const location=res.headers.get("location");if(!location)return {ok:false,reason:"Redirect response had no Location header"};
    if(hop===5)return {ok:false,reason:"Redirect limit exceeded"};
    try{current=new URL(location,current).toString();}catch{return {ok:false,reason:"Invalid redirect destination"};}
    continue;
   }
   if(!res.ok)return {ok:false,reason:"HTTP "+res.status};
   const type=(res.headers.get("content-type")||"").toLowerCase();
   if(type&&!/(text\/|application\/(xhtml\+xml|xml|json))/i.test(type))return {ok:false,reason:"Unsupported page content type: "+type.slice(0,80)};
   const html=await readLimitedText(res,250000);
   if(/captcha|cloudflare challenge|access denied/i.test(html.slice(0,12000)))return {ok:false,reason:"Blocked by challenge; automated inspection withheld"};
   return {ok:true,finalUrl:current,html};
  }catch(e){return {ok:false,reason:String(e.message||e).slice(0,200)};}
 }
 return {ok:false,reason:"Redirect limit exceeded"};
}
function cleanName(s){return String(s||"").replace(/\s+/g," ").replace(/[|<>]/g,"").trim().slice(0,160);}
function extractEmail(html){
 const found=[...String(html||"").matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)].map(x=>x[0].toLowerCase());
 return found.find(e=>/(music|submit|demo|artist|press|radio|playlist)/i.test(e))||null;
}
function detectDspPlaylistUrl(value){
 const raw=String(value||"");
 const patterns=[
  ["Spotify",/https?:\/\/(?:open\.)?spotify\.com\/playlist\/[A-Za-z0-9]+/i],
  ["YouTube Music",/https?:\/\/music\.youtube\.com\/playlist\?list=[A-Za-z0-9_-]+/i],
  ["YouTube",/https?:\/\/(?:www\.)?youtube\.com\/playlist\?list=[A-Za-z0-9_-]+/i],
  ["Apple Music",/https?:\/\/music\.apple\.com\/[^\s"'<>]+\/playlist\/[^\s"'<>]+/i],
  ["Deezer",/https?:\/\/(?:www\.)?deezer\.com\/(?:[a-z]{2}\/)?playlist\/[0-9]+/i],
  ["Tidal",/https?:\/\/(?:www\.)?tidal\.com\/browse\/playlist\/[A-Za-z0-9-]+/i]
 ];
 for(const [dsp,re] of patterns){const m=raw.match(re);if(m)return {dsp,url:m[0].replace(/[),.;]+$/,"")};}
 return null;
}
function extractDspPlaylist(html,url,snippet){
 const direct=detectDspPlaylistUrl(url);if(direct)return direct;
 // Publisher pages often serialize playlist links inside JSON/JS with escaped slashes.
 const raw=String(html||"")+" "+String(snippet||"");
 const normalized=decodeHtml(raw)
  .replace(/\\\//g,"/")
  .replace(/\\u002f/gi,"/")
  .replace(/\\u003a/gi,":")
  .replace(/\\u0026/gi,"&")
  .replace(/\\x2f/gi,"/")
  .replace(/\\x3a/gi,":");
 for(const source of [raw,normalized]){
  const links=[...source.matchAll(/https?:\/\/[^\s"'<>\\]+/gi)].map(m=>decodeHtml(m[0]));
  for(const link of links){const found=detectDspPlaylistUrl(link);if(found)return found;}
 }
 return null;
}
function extractCuratorProfileLinks(html,baseUrl){
 const links=new Set();let base;try{base=new URL(baseUrl);}catch{return [];}
 const raw=String(html||"");
 const hrefs=[...raw.matchAll(/(?:href|content|data-url)\s*=\s*["']([^"']+)["']/gi)].map(m=>decodeHtml(m[1]));
 const embedded=[...raw.matchAll(/https?:\/\/[^\s"'<>]+/gi)].map(m=>decodeHtml(m[0]));
 for(const value of [...hrefs,...embedded]){
  try{
   const u=new URL(value,base);
   if(!/^https?:$/.test(u.protocol))continue;
   if(u.hostname.toLowerCase().replace(/^www\./,"")!==base.hostname.toLowerCase().replace(/^www\./,""))continue;
   if(/\.(?:png|jpe?g|gif|svg|webp|css|js|pdf)(?:$|\?)/i.test(u.pathname))continue;
   if(!/(curator|profile|playlist|playlists|submit|artist|user)/i.test(u.pathname))continue;
   u.hash="";links.add(u.toString());
  }catch{}
  if(links.size>=8)break;
 }
 return [...links].slice(0,8);
}
async function inspectCuratorProfileEvidence(html,baseUrl){
 const direct=extractDspPlaylist(html,baseUrl,"");
 if(direct)return {html:"",profileUrl:baseUrl,playlist:direct};
 for(const profileUrl of extractCuratorProfileLinks(html,baseUrl)){
  const page=await inspect(profileUrl);if(!page.ok)continue;
  const playlist=extractDspPlaylist(page.html||"",page.finalUrl||profileUrl,"");
  if(playlist)return {html:page.html||"",profileUrl:page.finalUrl||profileUrl,playlist};
 }
 return {html:"",profileUrl:null,playlist:null};
}
function parseCount(raw){
 const value=String(raw||"").replace(/,/g,"").replace(/\s/gi,"").toLowerCase();
 const n=parseFloat(value);
 if(!Number.isFinite(n))return null;
 return Math.round(n*(value.endsWith("k")?1000:value.endsWith("m")?1000000:value.endsWith("b")?1000000000:1));
}
function extractPlaylistMetrics(value){
 const raw=String(value||"");
 // Read visible copy plus labelled metadata attributes used by curator cards.
 // Unlabelled numbers are never promoted into follower/response metrics.
 const attrs=[...raw.matchAll(/(?:aria-label|title|content|data-testid|data-count|data-followers|data-response-rate)\s*=\s*["']([^"']{1,500})["']/gi)].map(m=>m[1]).join(" ");
 const text=(stripTags(raw)+" "+decodeHtml(attrs)+" "+raw.replace(/<[^>]*>/g," ")).replace(/&nbsp;/gi," ").replace(/\s+/g," ");
 const followerPatterns=[
  /(?:followers|follower count|playlist followers|follower_count|followers_count|followersCount)\s*["']?\s*[:=\-]?\s*["']?([0-9][0-9,.]*\s*[kmb]?)/i,
  /([0-9][0-9,.]*\s*[kmb]?)\s+followers\b/i
 ];
 let followerCount=null;
 for(const re of followerPatterns){const m=text.match(re);if(m){followerCount=parseCount(m[1]);if(followerCount!==null)break;}}
 const responsePatterns=[
  /(?:response\s*rate|response_rate|responseRate)\s*["']?\s*[:=\-]?\s*["']?(100(?:\.0+)?|[0-9]{1,2}(?:\.[0-9]+)?)\s*%?/i,
  /(100(?:\.0+)?|[0-9]{1,2}(?:\.[0-9]+)?)\s*%\s*(?:response\s*rate)/i,
  /responds?\s+to\s+(100(?:\.0+)?|[0-9]{1,2}(?:\.[0-9]+)?)\s*%/i
 ];
 let responseRate=null;
 for(const re of responsePatterns){const m=text.match(re);if(m){responseRate=Number(m[1]);if(Number.isFinite(responseRate))break;}}
 const activeEvidence=/(?:status|curator status|playlist status|account status|activity_status)\s*["']?\s*[:=\-]?\s*["']?active\b|\bactive\s+(?:curator|playlist|profile)\b|\blast active\s*(?:today|yesterday|[0-9]{1,2}\s+(?:hours?|days?)\s+ago)\b|\bactive within (?:[0-9]{1,2} days?|30 days)\b|\bcurrently active\b/i.test(text);
 const inactiveEvidence=/\b(?:inactive|paused|closed|disabled|not active)\b/i.test(text);
 return {followerCount,responseRate,activityStatus:activeEvidence&&!inactiveEvidence?"active":"unknown",activeEvidence,inactiveEvidence};
}
function evidence(category,title,snippet,html,url,routeOverride=null){
 const page=String(html||"").slice(0,150000).toLowerCase();
 const route=routeOverride||extractSubmissionRoute(html,url);
 if(category==="playlist"){
  const dspPlaylist=extractDspPlaylist(html,url,snippet);
  if(!dspPlaylist)return {ok:false,reason:"No individual public DSP playlist URL found"};
  const hasSubmissionLanguage=/(submit music|submit your music|submit a track|submit track|music submission|send music|send us music|artist submissions|demo submission|submit here|accepting submissions)/i.test(page);
  return {ok:hasSubmissionLanguage&&!!route,reason:hasSubmissionLanguage&&route?null:"Playlist found; a live submission route was not independently confirmed",playlistUrl:dspPlaylist.url,dspName:dspPlaylist.dsp,directPlaylist:true,routeFound:!!route,submissionUrl:route?.url||null,submissionMethod:route?.method||"unknown",categoryMatch:true};
 }
 if(!/(submit music|submit your music|submit a track|submit track|music submission|send music|send us music|artist submissions|demo submission|submit here|accepting submissions)/i.test(page))return {ok:false,reason:"Inspected publisher page has no explicit music-submission evidence"};
 if(!route)return {ok:false,reason:"No identifiable HTTPS submission route on inspected publisher page"};
 if(category==="radio_station"&&!/(radio|broadcast|fm|station)/i.test(page))return {ok:false,reason:"No radio-station identity on inspected publisher page"};
 if(category==="blogger"&&!/(music blog|blog|magazine|editorial|music review|press)/i.test(page))return {ok:false,reason:"No music-editorial identity on inspected publisher page"};
 if(category==="curator"&&!/(playlist|curator|spotify)/i.test(page))return {ok:false,reason:"No playlist-curator identity on inspected publisher page"};
 if(category==="platform"&&!/(music|playlist|radio|blog|curator|artist)/i.test(page))return {ok:false,reason:"No music-submission platform identity on inspected page"};
 return {ok:true,directPageEvidence:true,routeFound:true,submissionUrl:route.url,submissionMethod:route.method,categoryMatch:true};
}
async function findIndependentCorroboration(category,name,primaryUrl,playlistUrl,dspName,hits){
 const primaryHost=hostnameOf(primaryUrl),primaryDomain=registrableDomain(primaryUrl);
 const terms=String(name||"").toLowerCase().split(/[^a-z0-9]+/i).filter(x=>x.length>3&&!["playlist","music","official","curated","best","with","from","that"].includes(x)).slice(0,6);
 if(!primaryHost||!primaryDomain||!terms.length)return {ok:false,reason:"Insufficient identity terms for independent corroboration"};
 for(const hit of (hits||[]).slice(0,20)){
  const candidate=hit.link,host=hostnameOf(candidate),domain=registrableDomain(candidate);
  if(!host||!isSafePublicHttpUrl(candidate)||!domain||domain===primaryDomain||host==="news.google.com"||host.endsWith(".news.google.com"))continue;
  const searchable=(String(hit.title||"")+" "+String(hit.snippet||"")).toLowerCase();
  const overlap=terms.filter(term=>searchable.includes(term)).length;
  if((playlistUrl&&searchable.includes(playlistUrl.toLowerCase()))||overlap>=Math.min(2,terms.length)){
   const inspected=await inspect(candidate);if(!inspected.ok)continue;
   const body=stripTags(inspected.html||"").toLowerCase(),bodyOverlap=terms.filter(term=>body.includes(term)).length;
   const identityMatch=(playlistUrl&&String(inspected.html||"").includes(playlistUrl))||bodyOverlap>=Math.min(2,terms.length);
   const categoryMatch=category==="playlist"?/(spotify|playlist|curator)/i.test(body):category==="radio_station"?/(radio|broadcast|fm|station)/i.test(body):category==="blogger"?/(music blog|magazine|music review|editorial)/i.test(body):category==="platform"?/(music submission|submission portal|playlist|radio|blog|curator)/i.test(body):/(playlist|curator|spotify)/i.test(body);
   if(identityMatch&&categoryMatch&&registrableDomain(inspected.finalUrl||candidate)!==primaryDomain)return {ok:true,url:inspected.finalUrl||candidate,host:hostnameOf(inspected.finalUrl||candidate),domain:registrableDomain(inspected.finalUrl||candidate),identityMatch:true,categoryMatch:true,reachable:true};
  }
 }
 return {ok:false,reason:"No second reachable independent domain in this search batch corroborated the same playlist identity"};
}

async function main(){
 let autoPublicationEnabled=true;
 try{
  const policy=await rest("opportunity_discovery_runtime_config?select=publication_policy_version&singleton=eq.true&limit=1");
  autoPublicationEnabled=Array.isArray(policy)&&policy[0]?.publication_policy_version===2;
  if(!autoPublicationEnabled)console.log("AUTOPUBLISH_DISABLED: publication policy version 2 is not active; qualified candidates will remain private.");
 }catch(e){autoPublicationEnabled=false;console.log("AUTOPUBLISH_DISABLED: migrations 0028-0029 are not active; discovery will continue without public publication. "+String(e.message||e).slice(0,250));}
 const runRows=await rest("hourly_opportunity_discovery_runs",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({status:"running"})});
 const runId=runRows[0].id;let seen=0,queued=0,rejected=0,duplicates=0,done=0;const providerDiagnostics={};const duplicateDetails=[];const rejectedDetails=[];const queuedDetails=[];const errors=[];const providerStats={};const processedByCategory={};const categorySeen=new Set();
 for(const item of activeQueries){
  try{
   const searchResult=await search(item.q);done++;
   for(const [provider,stats] of Object.entries(searchResult.providerStats||{})){
    providerStats[provider]??={queries:0,results:0,failures:0};
    providerStats[provider].queries++;providerStats[provider].results+=stats.count||0;
    if(stats.error){providerStats[provider].failures++;providerDiagnostics[provider]??=[];providerDiagnostics[provider].push({query:item.q,error:stats.error});}
   }
   for(const hit of searchResult.items){
    const categoryKey=item.category+"|"+hit.link.toLowerCase();
    if(categorySeen.has(categoryKey))continue;
    categorySeen.add(categoryKey);
    processedByCategory[item.category]=(processedByCategory[item.category]||0)+1;
    if(processedByCategory[item.category]>(item.category==="playlist"?180:12))continue;
    seen++;let url=hit.link;
    if(!url||!/^https?:\/\//i.test(url)){rejected++;continue;}
    let urlHost=hostnameOf(url);
    if(!isSafePublicHttpUrl(url)){
     rejectedDetails.push({category:item.category,name:cleanName(hit.title),url,provider:hit.provider||"unknown",evidenceReason:"Unsafe or non-public destination blocked"});
     rejected++;continue;
    }
    // Reject obvious dictionary/search-noise destinations before spending a page fetch.
    const noiseHosts=["dictionary.cambridge.org","cambridge.org","merriam-webster.com","vocabulary.com","thefreedictionary.com","dictionary.com","submittable.com"];
    if(noiseHosts.some(domain=>urlHost===domain||urlHost.endsWith("."+domain))){
     rejectedDetails.push({category:item.category,name:cleanName(hit.title),url,provider:hit.provider||"unknown",evidenceReason:"Excluded known dictionary or unrelated submission-platform noise"});
     rejected++;continue;
    }
    if(urlHost==="news.google.com"||urlHost.endsWith(".news.google.com")){
     rejectedDetails.push({category:item.category,name:cleanName(hit.title),url:hit.link,provider:hit.provider||"unknown",evidenceReason:"Google News redirect wrappers are excluded; only direct publisher URLs are accepted"});
     rejected++;continue;
    }
    let page=await inspect(url);

    const profileEvidence=item.category==="playlist"&&page.ok
      ? await inspectCuratorProfileEvidence(page.html||"",page.finalUrl||url)
      : {html:"",profileUrl:null,playlist:null};
    const metricHtml=(profileEvidence.html||"")+" "+(page.html||"");
    const route=extractSubmissionRoute(page.html||"",page.finalUrl||url)
      ||(profileEvidence.html?extractSubmissionRoute(profileEvidence.html,profileEvidence.profileUrl):null);
    const ev=evidence(item.category,hit.title||"",hit.snippet||"",metricHtml,page.finalUrl||url,route);
    const name=cleanName(hit.title);if(!name){rejected++;continue;}
    const finalUrl=page.finalUrl||url;
    let corroboration={ok:false,reason:"Primary publisher-page checks did not pass"};
    const searchable=(name+" "+(hit.snippet||"")+" "+(page.html||"").slice(0,30000)).toLowerCase();
    let host="",path="";
    try{const parsed=new URL(finalUrl);host=parsed.hostname.toLowerCase().replace(/^www\./,"");path=parsed.pathname.toLowerCase();}catch{}
    const genericRadioDirectories=["iheart.com","accuradio.com","radio.net","mytuner-radio.com","appradiofm.com","tunein.com","radio.garden"];
    const genericRadioLanding=genericRadioDirectories.some(domain=>host===domain||host.endsWith("."+domain))&&
      (path==="/"||/^\/(live|radio|home|stations?)\/?$/.test(path));
    const dspDestination=!!detectDspPlaylistUrl(finalUrl);
    const submissionEvidence=ev.ok===true;
    const categoryRelevant={
     playlist:!!ev.playlistUrl&&(submissionEvidence||ev.directPlaylist)&&/(playlist|curator|submit|mix|radio)/i.test(searchable),
     curator:!dspDestination&&submissionEvidence&&/(playlist curator|curator|submit.*playlist|playlist.*submit)/i.test(searchable),
     radio_station:!genericRadioLanding&&submissionEvidence&&/(radio|broadcast|fm|station)/i.test(searchable),
     blogger:submissionEvidence&&/(music blog|blog|magazine|editorial|music review)/i.test(searchable)&&!/(submithub|submitlink|playlistdock|indiemono|audiartist)/i.test(host),
     platform:submissionEvidence&&/(music submission|submission portal|playlist|radio|blog|curator|submit)/i.test(searchable)
    }[item.category]===true;
    if(!categoryRelevant){
     rejectedDetails.push({category:item.category,name,url:finalUrl,provider:hit.provider||"unknown",evidenceReason:ev.reason||"Evidence passed but category relevance check failed",dspDestination,genericRadioLanding,searchSnippet:(hit.snippet||"").slice(0,350)});
     // Rejected search noise is recorded in the run diagnostics, not inserted
     // into the admin candidate table. This keeps the review queue clean and
     // avoids treating unqualified search results as candidate records.
     rejected++;continue;
    }
    const html=page.html||"",email=extractEmail(html);
    const lowerText=(name+" "+(hit.snippet||"")+" "+html.slice(0,50000)).toLowerCase();
    const knownGenres=["Amapiano","Afro House","Afrobeats","Afrobeat","Deep House","Melodic House","Organic House","Hip Hop","Rap","R&B","Soul","Funk","Jazz","Blues","Rock","Alternative","Indie","Pop","Dance","EDM","House","Tech House","Progressive House","Techno","Trance","Drum and Bass","Dubstep","Garage","Disco","Reggae","Dancehall","Gospel","Christian","Classical","Country","Folk","Metal","Punk","Latin","Reggaeton","K-Pop","J-Pop","Ambient","Downtempo","Chillout","World Music"];
    const extractedGenres=knownGenres.filter(g=>lowerText.includes(g.toLowerCase()));
    const metrics=extractPlaylistMetrics(metricHtml+" "+(hit.snippet||"")+" "+name);
    const followerCount=metrics.followerCount;
    const responseRate=metrics.responseRate;
    const activityStatus=metrics.activityStatus;
    const playlistData=ev.playlistUrl?(" | DSP playlist: "+ev.dspName+" "+ev.playlistUrl+" | Curator profile: "+(profileEvidence.profileUrl||"source page")):"";
    const qualification=qualifiesPlaylist({playlistUrl:ev.playlistUrl,followerCount,responseRate,activityStatus,submissionUrl:ev.submissionUrl});
    if(!qualification.ok){
     rejectedDetails.push({category:"playlist",name,url:finalUrl,provider:hit.provider||"unknown",evidenceReason:qualification.failures.join("; "),followerCount,responseRate,activityStatus,submissionUrl:ev.submissionUrl,searchSnippet:(hit.snippet||"").slice(0,300)});
     rejected++;continue;
    }
    corroboration=await findIndependentCorroboration(item.category,name,finalUrl,ev.playlistUrl||null,ev.dspName||item.dsp||null,searchResult.items);
    const existing=await rest("opportunity_discovery_candidates?select=id,name,category,source_url,website_url,submission_url,review_status,activity_status,follower_count,response_rate&category=eq.playlist&source_url=eq."+encodeURIComponent(finalUrl)+"&limit=1");
    if(existing&&existing.length){duplicates++;duplicateDetails.push(existing[0]);continue;}
    await rest("hourly_opportunity_discovery_candidates?on_conflict=category,destination_url",{
     method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},
     body:JSON.stringify({run_id:runId,category:"playlist",name,destination_url:finalUrl,
      submission_url:ev.submissionUrl||null,
      evidence:("Title: "+name+playlistData+" | Followers: "+followerCount+" | Response rate: "+responseRate+"% | Activity: "+activityStatus+" | Genres: "+(extractedGenres.join(", ")||"not reliably extracted")+" | Search snippet: "+(hit.snippet||"No snippet returned")+" | Submission route: "+(ev.ok?"confirmed":ev.reason||"not confirmed")+" | Independent check: "+(corroboration.ok?"matched":"manual review required")).slice(0,1800),
      verification_status:"pending",
      verification_reason:"Playlist metrics meet configured thresholds; administrator review required"})
    });
    const candidate={category:item.category,name,country:item.region||null,dsp_name:ev.dspName||item.dsp||(item.category==="playlist"?"Spotify":null),
     genres:extractedGenres,website_url:ev.playlistUrl||finalUrl,submission_url:ev.submissionUrl||null,contact_email:email,
     submission_method:ev.submissionMethod||(email?"email":"unknown"),
     accepts_free_submissions:/free\s+(?:music\s+)?submissions?|submit\s+for\s+free/i.test(lowerText),follower_count:followerCount,response_rate:responseRate,
     activity_status:activityStatus,source_name:(hit.provider||"Public Web Search")+(item.dsp?" / "+item.dsp:""),
     source_url:finalUrl,evidence_url:page.ok?finalUrl:null,first_seen_at:now(),last_checked_at:now(),review_status:"pending",
     ...(autoPublicationEnabled?{auto_verification:ev.ok&&corroboration.ok?{
      schema_version:"2",score:qualification.score,score_type:"rule_gate_completion",
      reachable:true,direct_page_evidence:true,submission_route_found:true,category_match:true,canonical_destination:true,
      independent_corroboration:true,independent_source_reachable:true,independent_identity_match:true,independent_category_match:true,
      independent_source_url:corroboration.url,independent_source_host:corroboration.host,independent_source_domain:corroboration.domain,
      primary_source_host:hostnameOf(finalUrl),primary_source_domain:registrableDomain(finalUrl),
      metrics_source_url:profileEvidence.profileUrl||finalUrl,
      individual_playlist_url:ev.playlistUrl,submission_route_url:ev.submissionUrl,
      follower_count:followerCount,response_rate:responseRate,activity_status:activityStatus,
      verified_at:now(),verification_method:"deterministic checklist: live publisher page, explicit HTTPS submission route, individual Spotify playlist, >100 followers, active status, 0.5-100% response rate, and an independently reachable second domain matching the same playlist identity"
     }:null,auto_verified_at:ev.ok&&corroboration.ok?now():null}:{})};
    const inserted=await rest("opportunity_discovery_candidates",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(candidate)});
    const saved=Array.isArray(inserted)?inserted[0]:null;
    if(!saved?.id)throw new Error("Candidate insert did not return an ID; automatic publication withheld");
    queued++;queuedDetails.push({id:saved.id,category:"playlist",name,source_url:finalUrl,playlist_url:ev.playlistUrl,follower_count:followerCount,response_rate:responseRate,activity_status:activityStatus,genres:extractedGenres,submission_url:candidate.submission_url,contact_email:email,provider:hit.provider||"unknown"});
    if(ev.ok&&corroboration.ok&&autoPublicationEnabled){
     try{
      const publication=await rest("rpc/auto_publish_verified_opportunity_candidate",{method:"POST",body:JSON.stringify({p_candidate_id:saved.id})});
      const result=Array.isArray(publication)?publication[0]:publication;
      if(result?.status==="published"){queued--;queuedDetails.pop();queuedDetails.push({id:saved.id,category:item.category,name,status:"published",directory_id:result.directory_id});}
      else if(result?.status==="duplicate"){duplicates++;queued--;queuedDetails.pop();}
      else {providerDiagnostics["auto-publication"]??=[];providerDiagnostics["auto-publication"].push({id:saved.id,name,status:result?.status||"unknown",reason:result?.reason||"No publication confirmation"});}
     }catch(e){providerDiagnostics["auto-publication"]??=[];providerDiagnostics["auto-publication"].push({id:saved.id,name,error:String(e.message||e).slice(0,400)});}
    }
   }
  }catch(e){errors.push(item.category+": "+e.message);}
 }
 const status=errors.length?(done?"partial":"failed"):"completed";
 await rest("hourly_opportunity_discovery_runs?id=eq."+runId,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({
  finished_at:now(),status,searches_run:done,candidates_seen:seen,records_added:queuedDetails.filter(x=>x.status==="published").length,records_updated:0,
  records_rejected:rejected,error_summary:errors.join(" | ").slice(0,3000)||null})});
 console.log(JSON.stringify({runId,status,searchesRun:done,searchesPerRun:activeQueries.length,queryRotationIndex,queryPoolSize:queries.length,queryTexts:activeQueries.map(x=>x.q),searchProvider:"Brave Search API",playlistDiscoveryTarget:18000,playlistSearchRegions:playlistRegions.slice(0,18),providers:providerStats,candidatesSeen:seen,candidatesQueued:queued,recordsPublished:queuedDetails.filter(x=>x.status==="published").length,recordsRejected:rejected,duplicatesSkipped:duplicates,unaccounted:Math.max(0,seen-queued-rejected-duplicates),providerDiagnostics,duplicateDetails,rejectedDetails,queuedDetails,errors},null,2));
 if(!done)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
