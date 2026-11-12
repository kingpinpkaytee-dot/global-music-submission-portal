import { extractSubmissionRoute, extractPlaylistName, parseSearchRss, isRestrictedAutomationSource, hostnameOf, registrableDomain, isSafePublicHttpUrl, qualifiesPlaylist } from "./opportunity-discovery-core.mjs";

// Global music-opportunity discovery for Artist Frequency.
// Discovery backlog target: build toward 18,000+ researched candidates over time; this is a target, not a forecast or verified count.
// The target is a research backlog goal, NOT a claim about Spotify's playlist count.
// Auto-publication remains gated by fresh publisher-page evidence AND independent
// second-source corroboration. Published listings never enable in-platform submissions.
const SUPABASE_URL=process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(![SUPABASE_URL,SERVICE_ROLE_KEY].every(Boolean)) throw new Error("Missing required Supabase configuration.");
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
 "Jamaica","Trinidad and Tobago","Portugal","Poland"
];
// Playlist-only discovery: all genres, worldwide, across major DSPs and curator platforms.
// Qualification: strictly more than 100 followers, explicitly active, response rate 0.5%-100%.
const playlistQueries=playlistRegions.map(region=>({
 category:"playlist",region,
 q:`("Spotify playlist curator" OR "submit your music") ("followers" OR "response rate" OR "submission form") "${region}" active -jobs -definition -site:spotify.com -site:facebook.com -site:instagram.com -site:youtube.com -site:submitlink.io -site:submithub.com -site:soundplate.com -site:playlist.com`
}));
const platformPlaylistQueries=[
 {category:"playlist",dsp:"Independent curator profiles",q:'"Spotify playlist curator" "submission form" "followers" "response rate" -site:spotify.com -site:facebook.com -site:instagram.com -site:youtube.com -site:submitlink.io -site:submithub.com -site:soundplate.com'},
 {category:"playlist",dsp:"Independent curator profiles",q:'"submit your music" "Spotify playlist" curator "followers" active -site:spotify.com -site:facebook.com -site:instagram.com -site:youtube.com -site:submitlink.io -site:submithub.com -site:soundplate.com'},
 {category:"playlist",dsp:"Independent curator profiles",q:'"Spotify playlist" curator "response rate" "last active" -site:spotify.com -site:facebook.com -site:instagram.com -site:youtube.com -site:submitlink.io -site:submithub.com -site:soundplate.com'},
 {category:"playlist",dsp:"Independent curator profiles",q:'"Playlist Followers" "Response Rate" Spotify playlist submissions curator -site:spotify.com -site:facebook.com -site:instagram.com -site:youtube.com -site:submitlink.io -site:submithub.com -site:soundplate.com'},
 {category:"playlist",dsp:"Independent curator profiles",q:'"Spotify playlists" "submit music" "followers" "active curator" -site:spotify.com -site:facebook.com -site:instagram.com -site:youtube.com -site:submitlink.io -site:submithub.com -site:soundplate.com'},
 {category:"playlist",dsp:"Independent curator profiles",q:'"Spotify playlist submission" "response within" curator profile -site:spotify.com -site:facebook.com -site:instagram.com -site:youtube.com -site:submitlink.io -site:submithub.com -site:soundplate.com'},
 {category:"playlist",dsp:"Daily Playlists profiles",q:'site:dailyplaylists.com Spotify playlist curator followers submission active'},
 {category:"playlist",dsp:"Pitchplaylists profiles",q:'site:pitchplaylists.com Spotify playlist curator followers submissions'},
 {category:"playlist",dsp:"Groover profiles",q:'site:groover.co Spotify playlist curator "response rate" active'},
 {category:"playlist",dsp:"Playlist curator websites",q:'"Spotify playlist curator" "submit music" "contact" followers active independent'},
 {category:"playlist",dsp:"Playlist curator websites",q:'"Spotify playlist" curator "submission" "followers" "genres" music'},
 {category:"playlist",dsp:"Playlist curator websites",q:'"playlist pitch" Spotify curator active submissions followers'}
];
const queries=Array.from({length:Math.max(playlistQueries.length,platformPlaylistQueries.length)},(_,i)=>[playlistQueries[i],platformPlaylistQueries[i]].filter(Boolean)).flat();
const requestedSearches=Number(process.env.DISCOVERY_SEARCHES_PER_RUN||1);
const searchesPerRun=Number.isFinite(requestedSearches)?Math.max(1,Math.min(2,requestedSearches)):1;
const queryRotationIndex=(Math.floor(Date.now()/3600000)*searchesPerRun)%queries.length;
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
function resolveBingRedirect(value){
 try{
  const url=new URL(value);
  if(!/(^|\.)bing\.com$/i.test(url.hostname))return value;
  const direct=url.searchParams.get("url");
  if(direct&&isSafePublicHttpUrl(direct))return direct;
  const encoded=url.searchParams.get("u");
  if(encoded&&encoded.startsWith("a1")){
   const decoded=Buffer.from(encoded.slice(2),"base64url").toString("utf8");
   if(isSafePublicHttpUrl(decoded))return decoded;
  }
 }catch{}
 return value;
}
async function search(q){
 const endpoint=new URL("https://www.bing.com/search");
 endpoint.searchParams.set("format","rss");
 endpoint.searchParams.set("q",q);
 endpoint.searchParams.set("count","20");
 const response=await fetch(endpoint,{headers:{
  "User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Accept":"application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.5"
 },signal:AbortSignal.timeout(20000)});
 const xml=await response.text();
 if(!response.ok)throw new Error("Bing RSS HTTP "+response.status+": "+xml.slice(0,300));
 const parsed=parseSearchRss(xml).slice(0,20);
 const items=parsed.map(item=>({
  ...item,
  link:resolveBingRedirect(item.link),
  provider:"Bing RSS (free)"
 }));
 return {items,providerStats:{"Bing RSS (free)":{count:items.length,cost:0,statusCode:response.status,error:null}}};
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
function extractPageTitle(html){
 const source=String(html||"");
 const candidates=[
  source.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1],
  source.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i)?.[1],
  source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1],
  source.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
 ];
 for(const value of candidates){const title=cleanName(stripTags(value||""));if(title.length>=3)return title;}
 return "";
}

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
async function findIndependentCorroboration(category,name,primaryUrl,playlistUrl,dspName,hits,budget){
 const primaryHost=hostnameOf(primaryUrl),primaryDomain=registrableDomain(primaryUrl);
 const terms=String(name||"").toLowerCase().split(/[^a-z0-9]+/i).filter(x=>x.length>3&&!["playlist","music","official","curated","best","with","from","that"].includes(x)).slice(0,6);
 if(!primaryHost||!primaryDomain||!terms.length)return {ok:false,reason:"Insufficient identity terms for independent corroboration"};
 if(!budget||budget.remaining<=0)return {ok:false,reason:"Per-run independent inspection budget exhausted"};
 let attemptsForCandidate=0;
 for(const hit of (hits||[]).slice(0,20)){
  const candidate=hit.link,host=hostnameOf(candidate),domain=registrableDomain(candidate);
  if(!host||!isSafePublicHttpUrl(candidate)||!domain||domain===primaryDomain)continue;
  const searchable=(String(hit.title||"")+" "+String(hit.snippet||"")).toLowerCase();
  const overlap=terms.filter(term=>searchable.includes(term)).length;
  if((playlistUrl&&searchable.includes(playlistUrl.toLowerCase()))||overlap>=Math.min(2,terms.length)){
   if(budget.remaining<=0||attemptsForCandidate>=2)break;
   budget.remaining--;attemptsForCandidate++;
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
 const runId=runRows[0].id;let seen=0,queued=0,rejected=0,duplicates=0,done=0;const corroborationBudget={remaining:10};const providerDiagnostics={};const duplicateDetails=[];const rejectedDetails=[];const queuedDetails=[];const errors=[];const providerStats={};const processedByCategory={};const categorySeen=new Set();
 for(const item of activeQueries){
  try{
   const searchLocation=item.region||playlistRegions[queryRotationIndex%playlistRegions.length];
   const searchResult=await search(item.q,searchLocation);done++;
   for(const [provider,stats] of Object.entries(searchResult.providerStats||{})){
    providerStats[provider]??={queries:0,results:0,failures:0,costUsd:0};
    providerStats[provider].queries++;providerStats[provider].results+=stats.count||0;providerStats[provider].costUsd=Number((providerStats[provider].costUsd+(stats.cost||0)).toFixed(6));
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
     rejectedDetails.push({category:item.category,name:"Rejected search result",url,provider:hit.provider||"unknown",evidenceReason:"Unsafe or non-public destination blocked"});
     rejected++;continue;
    }
    // Respect published source restrictions and reject obvious generic landing-page noise before fetching.
    if(isRestrictedAutomationSource(url)){
     rejectedDetails.push({category:item.category,name:"Excluded source",url,provider:hit.provider||"unknown",evidenceReason:"Source terms restrict automated data collection, scraping or non-US use; no page content collected"});
     rejected++;continue;
    }
    const noiseHosts=["dictionary.cambridge.org","cambridge.org","merriam-webster.com","vocabulary.com","thefreedictionary.com","dictionary.com","submittable.com","facebook.com","instagram.com","youtube.com","accounts.spotify.com","artists.spotify.com","spotify.com","spotify.app.link"];
    if(noiseHosts.some(domain=>urlHost===domain||urlHost.endsWith("."+domain))){
     rejectedDetails.push({category:item.category,name:"Rejected search result",url,provider:hit.provider||"unknown",evidenceReason:"Excluded generic search-noise, social or streaming-service landing page"});
     rejected++;continue;
    }
    let page;
    if(urlHost==="news.google.com"||urlHost.endsWith(".news.google.com")){
     page=await inspect(url);
     if(!page.ok||hostnameOf(page.finalUrl||url)==="news.google.com"||String(page.finalUrl||url).includes("news.google.com")){
      rejectedDetails.push({category:item.category,name:"Unresolved Google News result",url:hit.link,provider:hit.provider||"unknown",evidenceReason:page.reason||"Google News did not resolve to a direct publisher page"});
      rejected++;continue;
     }
     url=page.finalUrl;
     urlHost=hostnameOf(url);
    }else{
     page=await inspect(url);
    }

    const profileEvidence=item.category==="playlist"&&page.ok
      ? await inspectCuratorProfileEvidence(page.html||"",page.finalUrl||url)
      : {html:"",profileUrl:null,playlist:null};
    const metricHtml=(profileEvidence.html||"")+" "+(page.html||"");
    const route=extractSubmissionRoute(page.html||"",page.finalUrl||url)
      ||(profileEvidence.html?extractSubmissionRoute(profileEvidence.html,profileEvidence.profileUrl):null);
    const publisherTitle=extractPageTitle(page.html||"")||extractPageTitle(profileEvidence.html||"");
    if(!publisherTitle){rejectedDetails.push({category:item.category,name:"Unidentified publisher page",url:page.finalUrl||url,provider:hit.provider||"unknown",evidenceReason:"Publisher page did not expose its own title"});rejected++;continue;}
    const ev=evidence(item.category,publisherTitle,"",metricHtml,page.finalUrl||url,route);
    const name=cleanName(extractPlaylistName(metricHtml,ev.playlistUrl,publisherTitle));
    if(!name){rejectedDetails.push({category:"playlist",name:"Unidentified Spotify playlist",url:page.finalUrl||url,provider:hit.provider||"unknown",evidenceReason:"Publisher page did not expose a specific playlist name"});rejected++;continue;}
    const finalUrl=page.finalUrl||url;
    let corroboration={ok:false,reason:"Primary publisher-page checks did not pass"};
    const searchable=(name+" "+metricHtml.slice(0,30000)).toLowerCase();
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
     rejectedDetails.push({category:item.category,name,url:finalUrl,provider:hit.provider||"unknown",evidenceReason:ev.reason||"Evidence passed but category relevance check failed",dspDestination,genericRadioLanding});
     // Rejected search noise is recorded in the run diagnostics, not inserted
     // into the admin candidate table. This keeps the review queue clean and
     // avoids treating unqualified search results as candidate records.
     rejected++;continue;
    }
    const html=page.html||"",email=extractEmail(metricHtml);
    const lowerText=(name+" "+metricHtml.slice(0,50000)).toLowerCase();
    const knownGenres=["Amapiano","Afro House","Afrobeats","Afrobeat","Deep House","Melodic House","Organic House","Hip Hop","Rap","R&B","Soul","Funk","Jazz","Blues","Rock","Alternative","Indie","Pop","Dance","EDM","House","Tech House","Progressive House","Techno","Trance","Drum and Bass","Dubstep","Garage","Disco","Reggae","Dancehall","Gospel","Christian","Classical","Country","Folk","Metal","Punk","Latin","Reggaeton","K-Pop","J-Pop","Ambient","Downtempo","Chillout","World Music"];
    const extractedGenres=knownGenres.filter(g=>lowerText.includes(g.toLowerCase()));
    const metrics=extractPlaylistMetrics(metricHtml+" "+name);
    const followerCount=metrics.followerCount;
    const responseRate=metrics.responseRate;
    const activityStatus=metrics.activityStatus;
    const playlistData=ev.playlistUrl?(" | DSP playlist: "+ev.dspName+" "+ev.playlistUrl+" | Curator profile: "+(profileEvidence.profileUrl||"source page")):"";
    const qualification=qualifiesPlaylist({playlistUrl:ev.playlistUrl,followerCount,responseRate,activityStatus,submissionUrl:ev.submissionUrl});
    if(!qualification.ok){
     rejectedDetails.push({category:"playlist",name,url:finalUrl,provider:hit.provider||"unknown",evidenceReason:qualification.failures.join("; "),followerCount,responseRate,activityStatus,submissionUrl:ev.submissionUrl});
     rejected++;continue;
    }
    corroboration=await findIndependentCorroboration(item.category,name,finalUrl,ev.playlistUrl||null,ev.dspName||item.dsp||null,searchResult.items,corroborationBudget);
    const existing=await rest("opportunity_discovery_candidates?select=id,name,category,source_url,website_url,submission_url,review_status,activity_status,follower_count,response_rate&category=eq.playlist&source_url=eq."+encodeURIComponent(finalUrl)+"&limit=1");
    if(existing&&existing.length){duplicates++;duplicateDetails.push(existing[0]);continue;}
    await rest("hourly_opportunity_discovery_candidates?on_conflict=category,destination_url",{
     method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},
     body:JSON.stringify({run_id:runId,category:"playlist",name,destination_url:finalUrl,
      submission_url:ev.submissionUrl||null,
      evidence:("Title: "+name+playlistData+" | Followers: "+followerCount+" | Response rate: "+responseRate+"% | Activity: "+activityStatus+" | Genres: "+(extractedGenres.join(", ")||"not reliably extracted")+" | Submission route: "+(ev.ok?"confirmed":ev.reason||"not confirmed")+" | Independent check: "+(corroboration.ok?"matched":"manual review required")).slice(0,1800),
      verification_status:"pending",
      verification_reason:"Playlist metrics meet configured thresholds; administrator review required"})
    });
    const candidate={category:item.category,name,country:null,dsp_name:ev.dspName||item.dsp||(item.category==="playlist"?"Spotify":null),
     genres:extractedGenres,website_url:ev.playlistUrl||finalUrl,submission_url:ev.submissionUrl||null,contact_email:email,
     submission_method:ev.submissionMethod||(email?"email":"unknown"),
     accepts_free_submissions:/free\s+(?:music\s+)?submissions?|submit\s+for\s+free/i.test(lowerText),follower_count:followerCount,response_rate:responseRate,
     activity_status:activityStatus,source_name:publisherTitle,
     source_url:finalUrl,evidence_url:page.ok?finalUrl:null,first_seen_at:now(),last_checked_at:now(),review_status:"pending",
     ...(autoPublicationEnabled?{auto_verification:ev.ok&&corroboration.ok?{
      schema_version:"2",score:qualification.score,score_type:"rule_gate_completion",
      reachable:true,direct_page_evidence:true,submission_route_found:true,category_match:true,canonical_destination:true,
      independent_corroboration:true,independent_source_reachable:true,independent_identity_match:true,independent_category_match:true,
      independent_source_url:corroboration.url,independent_source_host:corroboration.host,independent_source_domain:corroboration.domain,
      primary_source_host:hostnameOf(finalUrl),primary_source_domain:registrableDomain(finalUrl),
      metrics_source_url:profileEvidence.profileUrl||finalUrl,metrics_source_domain:registrableDomain(profileEvidence.profileUrl||finalUrl),
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
 console.log(JSON.stringify({runId,status,searchesRun:done,searchesPerRun:activeQueries.length,queryRotationIndex,queryPoolSize:queries.length,queryTexts:activeQueries.map(x=>x.q),queryLocations:activeQueries.map(x=>x.region||playlistRegions[queryRotationIndex%playlistRegions.length]),searchProvider:"Bing RSS (free)",playlistDiscoveryTarget:18000,playlistSearchRegions:playlistRegions,providers:providerStats,corroborationInspectionsRemaining:corroborationBudget.remaining,candidatesSeen:seen,candidatesQueued:queued,recordsPublished:queuedDetails.filter(x=>x.status==="published").length,recordsRejected:rejected,duplicatesSkipped:duplicates,unaccounted:Math.max(0,seen-queued-rejected-duplicates),providerDiagnostics,duplicateDetails,rejectedDetails,queuedDetails,errors},null,2));
 if(!done)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
