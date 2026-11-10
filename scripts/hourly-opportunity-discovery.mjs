// Global music-opportunity discovery for Artist Frequency.
// Public playlist discovery target: 18,000+ unique opportunities over time.
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
 "Jamaica","Trinidad and Tobago","France","Portugal","Poland"
];
// Playlist-only discovery: all genres, worldwide, across major DSPs and curator platforms.
// Qualification: strictly more than 100 followers, explicitly active, response rate 0.5%-100%.
const playlistQueries=playlistRegions.slice(0,18).map(region=>({
 category:"playlist",region,
 q:`("music playlist" OR "Spotify playlist" OR "Apple Music playlist" OR "YouTube playlist") ("followers" OR "response rate") "${region}" active curator -jobs -definition`
}));
const platformPlaylistQueries=[
 {category:"playlist",dsp:"Spotify",q:'site:open.spotify.com/playlist playlist followers curator active'},
 {category:"playlist",dsp:"YouTube",q:'site:youtube.com/playlist music playlist followers active curator'},
 {category:"playlist",dsp:"YouTube Music",q:'site:music.youtube.com/playlist playlist followers curator'},
 {category:"playlist",dsp:"Apple Music",q:'site:music.apple.com playlist followers curator'},
 {category:"playlist",dsp:"Deezer",q:'site:deezer.com playlist followers curator'},
 {category:"playlist",dsp:"Tidal",q:'site:tidal.com/browse/playlist playlist followers curator'},
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
 {category:"playlist",dsp:"Playlist curator profiles",q:'"active curator" "response rate" music playlist submit'}
];
const queries=[...playlistQueries,...platformPlaylistQueries];
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
function rssItems(xml){
 const source=String(xml||"");
 const blocks=[...source.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi)];
 return blocks.map(m=>{
  const block=m[1];
  const field=(tag)=>{const x=block.match(new RegExp("<"+tag+"\\b[^>]*>([\\s\\S]*?)</"+tag+">","i"));return x?stripTags(x[1].replace(/^<!\[CDATA\[|\]\]>$/g,"")):"";};
  let link=field("link");
  if(!link){const x=block.match(/<link\b[^>]*href=["']([^"']+)["']/i);if(x)link=decodeHtml(x[1]);}
  return {title:field("title"),link,snippet:field("description")||field("summary")};
 }).filter(x=>/^https?:\/\//i.test(x.link));
}
async function fetchFeed(url,label){
 const res=await fetch(url,{headers:{"Accept":"application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5","User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"},signal:AbortSignal.timeout(18000)});
 const body=await res.text();
 if(!res.ok)throw new Error(label+" HTTP "+res.status+": "+body.slice(0,160).replace(/\s+/g," "));
 const items=rssItems(body);
 if(items.length)return items;
 const validFeed=/<(?:rss|feed)\b/i.test(body);
 const hasEntries=/<(?:item|entry)\b/i.test(body);
 const reason=validFeed&&!hasEntries?"valid RSS/Atom feed contained zero entries":"response contained entries or content that the parser could not extract";
 throw new Error(label+" "+reason+" (type="+(res.headers.get("content-type")||"unknown")+", bytes="+body.length+", preview="+body.slice(0,100).replace(/\s+/g," ")+")");
}
function googleNewsEmbeddedUrl(link){
 try{
  const match=String(link).match(/\/rss\/articles\/([^?]+)/i);if(!match)return null;
  const decoded=Buffer.from(match[1].replace(/-/g,"+").replace(/_/g,"/"),"base64").toString("utf8");
  const urls=decoded.match(/https?:\/\/[^\s"'<>\\u0000-\\u001f]+/g)||[];
  for(const raw of urls){try{const u=new URL(raw);if(!/(^|\.)news\.google\.com$/i.test(u.hostname))return u.toString();}catch{}}
 }catch{} return null;
}
async function search(q){
 const providers=[
  {name:"Bing RSS",run:async()=>{
   const u=new URL("https://www.bing.com/search");
   u.searchParams.set("format","rss");u.searchParams.set("q",q);u.searchParams.set("count","20");
   return fetchFeed(u,"Bing RSS");
  }},
  {name:"Google News RSS",run:async()=>{
   const u=new URL("https://news.google.com/rss/search");
   u.searchParams.set("q",q);u.searchParams.set("hl","en-US");u.searchParams.set("gl","US");u.searchParams.set("ceid","US:en");
   return fetchFeed(u,"Google News RSS");
  }},

 ];
 const results=await Promise.allSettled(providers.map(async p=>({provider:p.name,items:await p.run()})));
 const buckets=[],stats={};
 for(let i=0;i<results.length;i++){
  const r=results[i],name=providers[i].name;
  if(r.status!=="fulfilled"){stats[name]={count:0,error:String(r.reason?.message||r.reason).slice(0,500)};continue;}
  const items=r.value.items.slice(0,20);
  stats[name]={count:items.length,error:null};
  const bucket=[];
  for(const hit of items){
   let link=hit.link;
   // Resolve common Bing redirect wrappers before inspecting the destination.
   try{const p=new URL(link);if(p.hostname.endsWith("bing.com")&&p.searchParams.has("url"))link=p.searchParams.get("url");}catch{}
   bucket.push({...hit,link,provider:name});
  }
  buckets.push(bucket);
 }
 // Round-robin providers so the first engine cannot crowd out the others.
 const unique=[],seen=new Set();
 for(let index=0;index<20;index++){
  for(const bucket of buckets){
   const hit=bucket[index];if(!hit)continue;
   try{
    const u=new URL(hit.link);u.hash="";u.search="";
    const key=u.toString().replace(/\/$/,"").toLowerCase();
    if(seen.has(key))continue;seen.add(key);unique.push(hit);
   }catch{}
   if(unique.length>=20)break;
  }
  if(unique.length>=20)break;
 }
 return {items:unique,providerStats:stats};
}
async function inspect(url){
 try{
  const res=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(12000),headers:{"User-Agent":"ArtistFrequencyOpportunityResearch/1.1"}});
  if(!res.ok)return {ok:false,reason:"HTTP "+res.status};
  const type=res.headers.get("content-type")||"";
  const html=type.includes("text")?(await res.text()).slice(0,250000):"";
  if(/captcha|cloudflare challenge|access denied/i.test(html.slice(0,12000)))return {ok:false,reason:"Blocked by challenge; manual review required"};
  return {ok:true,finalUrl:res.url,html};
 }catch(e){return {ok:false,reason:String(e.message||e)};}
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
 const haystack=String(html||"")+" "+String(snippet||"");
 const links=[...haystack.matchAll(/https?:\/\/[^\s"'<>]+/gi)].map(m=>decodeHtml(m[0]));
 for(const link of links){const found=detectDspPlaylistUrl(link);if(found)return found;}
 return null;
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
function evidence(category,title,snippet,html,url){
 const page=String(html||"").slice(0,150000).toLowerCase();
 if(category==="playlist"){
  const dspPlaylist=extractDspPlaylist(html,url,snippet);
  if(!dspPlaylist)return {ok:false,reason:"No individual public DSP playlist URL found"};
  const hasSubmissionLanguage=/(submit music|submit your music|submit a track|submit track|music submission|send music|send us music|artist submissions|demo submission|submit here|accepting submissions)/i.test(page);
  const route=/<form\b/i.test(page)||/mailto:/i.test(page)||/href\s*=\s*["'][^"']*(submit|submission|demo|upload|pitch)[^"']*["']/i.test(page)||/\/(submit|submission|demo|music-upload|pitch)(\/|\?|$)/i.test(url);
  return {ok:hasSubmissionLanguage&&route,reason:hasSubmissionLanguage&&route?null:"Playlist found; submission route not independently confirmed",playlistUrl:dspPlaylist.url,dspName:dspPlaylist.dsp,directPlaylist:true,routeFound:route,categoryMatch:true};
 }
 if(!/(submit music|submit your music|submit a track|submit track|music submission|send music|send us music|artist submissions|demo submission|submit here|accepting submissions)/i.test(page))
  return {ok:false,reason:"Inspected publisher page has no explicit music-submission evidence"};
 const route=/<form\b/i.test(page)||/mailto:/i.test(page)||/href\s*=\s*["'][^"']*(submit|submission|demo|upload|pitch)[^"']*["']/i.test(page)||/\/(submit|submission|demo|music-upload|pitch)(\/|\?|$)/i.test(url);
 if(!route)return {ok:false,reason:"No identifiable submission route on inspected publisher page"};
 if(category==="radio_station"&&!/(radio|broadcast|fm|station)/i.test(page))return {ok:false,reason:"No radio-station identity on inspected publisher page"};
 if(category==="blogger"&&!/(music blog|blog|magazine|editorial|music review|press)/i.test(page))return {ok:false,reason:"No music-editorial identity on inspected publisher page"};
 if(category==="curator"&&!/(playlist|curator|spotify)/i.test(page))return {ok:false,reason:"No playlist-curator identity on inspected publisher page"};
 if(category==="platform"&&!/(music|playlist|radio|blog|curator|artist)/i.test(page))return {ok:false,reason:"No music-submission platform identity on inspected page"};
 return {ok:true,directPageEvidence:true,routeFound:true,categoryMatch:true};
}
function hostnameOf(value){
 try{return new URL(value).hostname.toLowerCase().replace(/^www\./,"");}catch{return "";}
}
async function resolveGoogleNewsPublisher(hit){
 const title=cleanName(hit.title);
 if(!title)return null;
 // Google News RSS sometimes returns opaque article wrappers. Search the exact
 // headline on Bing and accept only an inspected external page whose content
 // independently contains multiple meaningful headline terms.
 try{
  const u=new URL("https://www.bing.com/search");
  u.searchParams.set("format","rss");
  u.searchParams.set("q",'"'+title.replace(/["']/g," ")+'"');
  u.searchParams.set("count","10");
  const results=await fetchFeed(u,"Bing exact-headline resolution");
  const terms=title.toLowerCase().split(/\s+/).filter(x=>x.length>3).slice(0,6);
  for(const item of results.slice(0,8)){
   let candidate=item.link;
   try{
    const parsed=new URL(candidate);
    if(parsed.hostname==="news.google.com"||parsed.hostname.endsWith(".news.google.com")||parsed.hostname.endsWith("bing.com"))continue;
   }catch{continue;}
   const overlap=terms.filter(t=>(item.title||"").toLowerCase().includes(t)).length;
   if(overlap<Math.min(2,terms.length))continue;
   const page=await inspect(candidate);
   if(!page.ok)continue;
   const body=stripTags(page.html||"").toLowerCase();
   const pageOverlap=terms.filter(t=>body.includes(t)).length;
   if(pageOverlap>=Math.min(2,terms.length))return page.finalUrl||candidate;
  }
 }catch{}
 // Last attempt: follow the Google News redirect and inspect canonical metadata.
 try{
  const page=await inspect(hit.link);
  if(page.ok){
   const html=String(page.html||"");
   const canonical=html.match(/<link[^>]+rel=["'](?:canonical|alternate)["'][^>]+href=["']([^"']+)["']/i)
    ||html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
   if(canonical){
    const target=new URL(decodeHtml(canonical[1]),page.finalUrl||hit.link);
    if(!/(^|\\.)news\\.google\\.com$/i.test(target.hostname))return target.toString();
   }
  }
 }catch{}
 return null;
}
async function findIndependentCorroboration(category,name,primaryUrl,playlistUrl,dspName){
 const primaryHost=hostnameOf(primaryUrl);
 const queryName=String(name||"").replace(/[^\p{L}\p{N} ]/gu," ").replace(/\s+/g," ").trim().slice(0,100);
 if(!queryName)return {ok:false,reason:"No usable identity for second-source search"};
 const q=category==="playlist"
  ? `"${queryName}" ${dspName||"music"} playlist curator`
  : `"${queryName}" music submissions ${category==="radio_station"?"radio station":category==="blogger"?"music blog":"playlist curator"}`;
 let found;
 try{found=await search(q);}catch(e){return {ok:false,reason:"Independent search failed: "+String(e.message||e).slice(0,180)};}
 const terms=queryName.toLowerCase().split(/\s+/).filter(x=>x.length>2).slice(0,3);
 for(const hit of (found.items||[]).slice(0,8)){
  const url=hit.link;
  const host=hostnameOf(url);
  if(!host||host===primaryHost||host==="news.google.com"||host.endsWith(".news.google.com"))continue;
  const inspected=await inspect(url);
  if(!inspected.ok)continue;
  const html=String(inspected.html||"").slice(0,180000);
  const textContent=stripTags(html).toLowerCase();
  const identityMatch=(playlistUrl&&html.includes(playlistUrl))||terms.filter(t=>textContent.includes(t)).length>=Math.min(2,terms.length);
  const categoryMatch=category==="playlist"
    ? /(spotify|playlist|curator)/i.test(textContent)
    : category==="radio_station"
      ? /(radio|broadcast|fm|station)/i.test(textContent)
      : category==="blogger"
        ? /(music blog|magazine|music review|editorial)/i.test(textContent)
        : category==="platform"
          ? /(music submission|submission portal|playlist|radio|blog|curator)/i.test(textContent)
          : /(playlist|curator|spotify)/i.test(textContent);
  if(identityMatch&&categoryMatch&&hostnameOf(inspected.finalUrl||url)!==primaryHost){
   return {ok:true,url:inspected.finalUrl||url,host:hostnameOf(inspected.finalUrl||url),identityMatch:true,categoryMatch:true,reachable:true};
  }
 }
 return {ok:false,reason:"No reachable, identity-matching independent source found"};
}
async function main(){
 let autoPublicationEnabled=true;
 try{await rest("opportunity_discovery_candidates?select=auto_verification&limit=0");}
 catch(e){autoPublicationEnabled=false;console.log("AUTOPUBLISH_DISABLED: database migration 0028 is not active or schema cache is stale; discovery will continue without publishing. "+String(e.message||e).slice(0,250));}
 const runRows=await rest("hourly_opportunity_discovery_runs",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({status:"running"})});
 const runId=runRows[0].id;let seen=0,queued=0,rejected=0,duplicates=0,done=0;const providerDiagnostics={};const duplicateDetails=[];const rejectedDetails=[];const queuedDetails=[];const errors=[];const providerStats={};const processedByCategory={};const categorySeen=new Set();
 for(const item of queries){
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
    // Follow Google News RSS redirects once; retain only real publisher destinations.
    let urlHost="";
    try{urlHost=new URL(url).hostname.toLowerCase();}catch{}
    // Reject obvious dictionary/search-noise destinations before spending a page fetch.
    const noiseHosts=["dictionary.cambridge.org","cambridge.org","merriam-webster.com","vocabulary.com","thefreedictionary.com","dictionary.com","submittable.com"];
    if(noiseHosts.some(domain=>urlHost===domain||urlHost.endsWith("."+domain))){
     rejectedDetails.push({category:item.category,name:cleanName(hit.title),url,provider:hit.provider||"unknown",evidenceReason:"Excluded known dictionary or unrelated submission-platform noise"});
     rejected++;continue;
    }
    if(urlHost==="news.google.com"||urlHost.endsWith(".news.google.com")){
     url=googleNewsEmbeddedUrl(url)||await resolveGoogleNewsPublisher(hit);
     if(!url){
      rejectedDetails.push({category:item.category,name:cleanName(hit.title),url:hit.link,provider:hit.provider||"unknown",evidenceReason:"Google News article destination could not be independently resolved"});
      rejected++;continue;
     }
    }
    let page=await inspect(url);
    if((urlHost==="news.google.com"||urlHost.endsWith(".news.google.com"))&&page.ok){
     let finalHost="";try{finalHost=new URL(page.finalUrl||url).hostname.toLowerCase();}catch{}
     if(finalHost==="news.google.com"||finalHost.endsWith(".news.google.com"))page={ok:false,reason:"Google News wrapper did not expose a publisher destination"};
    }
    const ev=evidence(item.category,hit.title||"",hit.snippet||"",page.html||"",page.finalUrl||url);
    const name=cleanName(hit.title);if(!name){rejected++;continue;}
    const finalUrl=page.finalUrl||url;
    const corroboration=ev.ok?await findIndependentCorroboration(item.category,name,finalUrl,ev.playlistUrl||null,ev.dspName||item.dsp||null):{ok:false,reason:"Primary publisher-page checks did not pass"};
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
    const metrics=extractPlaylistMetrics(lowerText+" "+(hit.snippet||""));
    const followerCount=metrics.followerCount;
    const responseRate=metrics.responseRate;
    const activityStatus=metrics.activityStatus;
    const playlistData=ev.playlistUrl?(" | DSP playlist: "+ev.dspName+" "+ev.playlistUrl):"";
    const failedCriteria=[];
    if(!ev.playlistUrl)failedCriteria.push("no individual public DSP playlist URL");
    if(followerCount===null||followerCount<=100)failedCriteria.push("follower count must be greater than 100");
    if(activityStatus!=="active")failedCriteria.push("active status not explicitly confirmed");
    if(responseRate===null||responseRate<0.5||responseRate>100)failedCriteria.push("response rate must be between 0.5% and 100%");
    if(failedCriteria.length){
     rejectedDetails.push({category:"playlist",name,url:finalUrl,provider:hit.provider||"unknown",evidenceReason:failedCriteria.join("; "),followerCount,responseRate,activityStatus,searchSnippet:(hit.snippet||"").slice(0,300)});
     rejected++;continue;
    }
    const existing=await rest("opportunity_discovery_candidates?select=id,name,category,source_url,website_url,submission_url,review_status,activity_status,follower_count,response_rate&category=eq.playlist&source_url=eq."+encodeURIComponent(finalUrl)+"&limit=1");
    if(existing&&existing.length){duplicates++;duplicateDetails.push(existing[0]);continue;}
    await rest("hourly_opportunity_discovery_candidates?on_conflict=category,destination_url",{
     method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},
     body:JSON.stringify({run_id:runId,category:"playlist",name,destination_url:finalUrl,
      submission_url:ev.ok?finalUrl:null,
      evidence:("Title: "+name+playlistData+" | Followers: "+followerCount+" | Response rate: "+responseRate+"% | Activity: "+activityStatus+" | Genres: "+(extractedGenres.join(", ")||"not reliably extracted")+" | Search snippet: "+(hit.snippet||"No snippet returned")+" | Submission route: "+(ev.ok?"confirmed":ev.reason||"not confirmed")+" | Independent check: "+(corroboration.ok?"matched":"manual review required")).slice(0,1800),
      verification_status:"pending",
      verification_reason:"Playlist metrics meet configured thresholds; administrator review required"})
    });
    const candidate={category:item.category,name,country:item.region||null,dsp_name:ev.dspName||item.dsp||(item.category==="playlist"?"Spotify":null),
     genres:extractedGenres,website_url:ev.playlistUrl||finalUrl,submission_url:ev.ok?finalUrl:null,contact_email:email,
     submission_method:email?"email":(ev.ok?(/mailto:/i.test(html)?"email":"form"):"unknown"),
     accepts_free_submissions:false,follower_count:followerCount,response_rate:responseRate,
     activity_status:activityStatus,source_name:(hit.provider||"Public Web Search")+(item.dsp?" / "+item.dsp:""),
     source_url:finalUrl,evidence_url:page.ok?finalUrl:null,first_seen_at:now(),last_checked_at:now(),review_status:"pending",
     ...(autoPublicationEnabled?{auto_verification:ev.ok&&corroboration.ok?{schema_version:"1",score:98,reachable:true,direct_page_evidence:true,
      submission_route_found:true,category_match:true,canonical_destination:true,
      independent_corroboration:true,independent_source_reachable:true,
      independent_identity_match:true,independent_source_url:corroboration.url,
      individual_playlist_url:ev.playlistUrl||null,verified_at:now(),
      verification_method:"live publisher-page inspection plus independent reachable source corroborating playlist identity and category; follower, active-status and response-rate thresholds met"}:null,
      auto_verified_at:ev.ok&&corroboration.ok?now():null}:{})};
    const inserted=await rest("opportunity_discovery_candidates",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(candidate)});
    const saved=Array.isArray(inserted)?inserted[0]:null;
    if(!saved?.id)throw new Error("Candidate insert did not return an ID; automatic publication withheld");
    queued++;queuedDetails.push({id:saved.id,category:"playlist",name,source_url:finalUrl,playlist_url:ev.playlistUrl,follower_count:followerCount,response_rate:responseRate,activity_status:activityStatus,genres:extractedGenres,submission_url:candidate.submission_url,contact_email:email,provider:hit.provider||"unknown"});
    if(ev.ok&&autoPublicationEnabled){
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
 console.log(JSON.stringify({runId,status,searchesRun:done,playlistDiscoveryTarget:18000,playlistSearchRegions:playlistRegions.slice(0,18),providers:providerStats,candidatesSeen:seen,candidatesQueued:queued,recordsPublished:queuedDetails.filter(x=>x.status==="published").length,recordsRejected:rejected,duplicatesSkipped:duplicates,unaccounted:Math.max(0,seen-queued-rejected-duplicates),providerDiagnostics,duplicateDetails,rejectedDetails,queuedDetails,errors},null,2));
 if(!done)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
