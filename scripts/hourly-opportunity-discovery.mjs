// Public web-search discovery for Artist Frequency (Bing RSS, DuckDuckGo HTML fallback).
// Candidates are queued for administrator review. This worker never publishes
// directory entries or enables submissions.
const SUPABASE_URL=process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(![SUPABASE_URL,SERVICE_ROLE_KEY].every(Boolean)) throw new Error("Missing required Supabase configuration.");
// Supabase's newer sb_secret_* keys are API keys, not JWTs: send them only
// in apikey. Legacy service_role keys are JWTs and may also be sent as Bearer.
const isNewSecretKey=SERVICE_ROLE_KEY.startsWith("sb_secret_");
if(SERVICE_ROLE_KEY.startsWith("sb_publishable_")||SERVICE_ROLE_KEY.startsWith("sb_anon_")) throw new Error("SUPABASE_SERVICE_ROLE_KEY must be a server-side Supabase secret key (sb_secret_*) or legacy service_role JWT, not a publishable/anon key.");
if(!isNewSecretKey&&SERVICE_ROLE_KEY.split(".").length!==3) throw new Error("SUPABASE_SERVICE_ROLE_KEY must be an sb_secret_* key or a legacy three-part service_role JWT.");
const headers={apikey:SERVICE_ROLE_KEY,...(isNewSecretKey?{}:{Authorization:"Bearer "+SERVICE_ROLE_KEY}),"Content-Type":"application/json"};
const queries=[
 {category:"playlist",q:'Spotify playlist "submit your track" OR "submit music" free curator'},
 {category:"radio_station",q:'radio station "music submissions" OR "submit your music" independent artists'},
 {category:"blogger",q:'music blog OR music magazine "submit music" OR "send us music"'},
 {category:"curator",q:'Spotify playlist curator "submit track" OR "music submission" open'}
];
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
 throw new Error(label+" returned no parseable results (type="+(res.headers.get("content-type")||"unknown")+", bytes="+body.length+", preview="+body.slice(0,100).replace(/\s+/g," ")+")");
}
async function search(q){
 const failures=[];
 const bing=new URL("https://www.bing.com/search");
 bing.searchParams.set("format","rss");bing.searchParams.set("q",q);bing.searchParams.set("count","20");
 try{return await fetchFeed(bing,"Bing RSS");}catch(e){failures.push(e.message);}
 const googleNews=new URL("https://news.google.com/rss/search");
 googleNews.searchParams.set("q",q);googleNews.searchParams.set("hl","en-US");googleNews.searchParams.set("gl","US");googleNews.searchParams.set("ceid","US:en");
 try{return await fetchFeed(googleNews,"Google News RSS");}catch(e){failures.push(e.message);}
 try{
  const ddg=new URL("https://html.duckduckgo.com/html/");
  ddg.searchParams.set("q",q);
  const res=await fetch(ddg,{headers:{"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36","Accept":"text/html,application/xhtml+xml"},signal:AbortSignal.timeout(18000)});
  const html=await res.text();
  if(!res.ok)throw new Error("DuckDuckGo HTML HTTP "+res.status+": "+html.slice(0,160));
  const anchors=[...html.matchAll(/<a\b([^>]*class=["'][^"']*result__a[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi)];
  const items=anchors.map(m=>{
   const href=m[1].match(/href=["']([^"']+)["']/i);
   let link=href?decodeHtml(href[1]):"";
   try{const parsed=new URL(link);if(parsed.hostname.includes("duckduckgo.com")&&parsed.searchParams.has("uddg"))link=parsed.searchParams.get("uddg");}catch{}
   const near=html.slice(m.index,m.index+5000);
   const snip=near.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
   return {title:stripTags(m[2]),link,snippet:snip?stripTags(snip[1]):""};
  }).filter(x=>/^https?:\/\//i.test(x.link));
  if(items.length)return items;
  throw new Error("DuckDuckGo returned no result anchors (type="+(res.headers.get("content-type")||"unknown")+", bytes="+html.length+", preview="+html.slice(0,100).replace(/\s+/g," ")+")");
 }catch(e){failures.push(e.message);}
 throw new Error(failures.join("; "));
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
function evidence(category,title,snippet,html,url){
 const all=(title+" "+snippet+" "+html.slice(0,100000)).toLowerCase();
 if(!/(submit music|submit your music|submit a track|submit track|music submission|send music|send us music|artist submissions|demo submission|submit here)/i.test(all))return {ok:false,reason:"No explicit music-submission evidence"};
 const route=/<form\b|mailto:|href\s*=\s*["'][^"']*(submit|submission|demo|upload|pitch)[^"']*["']/i.test(html)||/\/(submit|submission|demo|music-upload|pitch)/i.test(url);
 if(!route)return {ok:false,reason:"No identifiable submission route"};
 if(category==="playlist"){
  const spotify=html.match(/https?:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i);
  if(!spotify)return {ok:false,reason:"No individual Spotify playlist URL; manual review required"};
  return {ok:true,spotifyUrl:spotify[0]};
 }
 if(category==="radio_station"&&!/(radio|broadcast|fm|station)/i.test(all))return {ok:false,reason:"No radio-station identity"};
 if(category==="blogger"&&!/(blog|magazine|editorial|music review|press)/i.test(all))return {ok:false,reason:"No music-editorial identity"};
 if(category==="curator"&&!/(playlist|curator|spotify)/i.test(all))return {ok:false,reason:"No playlist-curator identity"};
 return {ok:true};
}
async function main(){
 const runRows=await rest("hourly_opportunity_discovery_runs",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({status:"running"})});
 const runId=runRows[0].id;let seen=0,queued=0,rejected=0,duplicates=0,done=0;const duplicateDetails=[];const rejectedDetails=[];const queuedDetails=[];const errors=[];
 for(const item of queries){
  try{
   const hits=await search(item.q);done++;
   for(const hit of hits){
    seen++;const url=hit.link;
    if(!url||!/^https?:\/\//i.test(url)){rejected++;continue;}
    const page=await inspect(url);
    const ev=page.ok?evidence(item.category,hit.title||"",hit.snippet||"",page.html||"",page.finalUrl||url):{ok:false,reason:page.reason||"Destination could not be inspected; manual review required"};
    const name=cleanName(hit.title);if(!name){rejected++;continue;}
    const finalUrl=page.finalUrl||url;
    const searchable=(name+" "+(hit.snippet||"")+" "+(page.html||"").slice(0,30000)).toLowerCase();
    let host="",path="";
    try{const parsed=new URL(finalUrl);host=parsed.hostname.toLowerCase().replace(/^www\./,"");path=parsed.pathname.toLowerCase();}catch{}
    const genericRadioDirectories=["iheart.com","accuradio.com","radio.net","mytuner-radio.com","appradiofm.com","tunein.com","radio.garden"];
    const genericRadioLanding=genericRadioDirectories.some(domain=>host===domain||host.endsWith("."+domain))&&
      (path==="/"||/^\/(live|radio|home|stations?)\/?$/.test(path));
    const spotifyDestination=host==="spotify.com"||host.endsWith(".spotify.com")||host==="spotify.link"||host.endsWith(".spotify.link");
    const submissionEvidence=ev.ok===true;
    const categoryRelevant={
     playlist:!spotifyDestination&&submissionEvidence&&!!ev.spotifyUrl&&/(playlist|curator|submit)/i.test(searchable),
     curator:!spotifyDestination&&submissionEvidence&&/(playlist curator|curator|submit.*playlist|playlist.*submit)/i.test(searchable),
     radio_station:!genericRadioLanding&&submissionEvidence&&/(radio|broadcast|fm|station)/i.test(searchable),
     blogger:submissionEvidence&&/(music blog|blog|magazine|editorial|music review)/i.test(searchable)
    }[item.category]===true;
    if(!categoryRelevant){
     rejectedDetails.push({category:item.category,name,url:finalUrl,evidenceReason:ev.reason||"Evidence passed but category relevance check failed",spotifyDestination,genericRadioLanding,searchSnippet:(hit.snippet||"").slice(0,350)});
     await rest("hourly_opportunity_discovery_candidates?on_conflict=category,destination_url",{
      method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},
      body:JSON.stringify({run_id:runId,category:item.category,name,destination_url:finalUrl,
       submission_url:null,evidence:(hit.title+" — "+(hit.snippet||"")).slice(0,1800),
       verification_status:"rejected",verification_reason:"Search result did not contain enough category-specific relevance; excluded from admin queue"})
     });
     rejected++;continue;
    }
    await rest("hourly_opportunity_discovery_candidates?on_conflict=category,destination_url",{
     method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},
     body:JSON.stringify({run_id:runId,category:item.category,name,destination_url:finalUrl,
      submission_url:ev.ok?finalUrl:null,
      evidence:("Title: "+name+" | Search snippet: "+(hit.snippet||"No snippet returned")+" | Automatic check: "+(ev.ok?"passed; administrator verification still required":ev.reason)).slice(0,1800),
      verification_status:"pending",
      verification_reason:ev.ok?"Automatic checks passed; administrator review required":ev.reason+"; retained for administrator review"})
    });
    const existing=await rest("opportunity_discovery_candidates?select=id,name,category,source_url,website_url,submission_url,review_status,activity_status&category=eq."+encodeURIComponent(item.category)+"&source_url=eq."+encodeURIComponent(url)+"&limit=1");
    if(existing&&existing.length){duplicates++;duplicateDetails.push(existing[0]);continue;}
    const html=page.html||"",email=extractEmail(html);
    const candidate={category:item.category,name,country:null,dsp_name:item.category==="playlist"?"Spotify":null,
     genres:[],website_url:ev.spotifyUrl||finalUrl,submission_url:ev.ok?finalUrl:null,contact_email:email,
     submission_method:email?"email":(ev.ok?( /mailto:/i.test(html)?"email":"form"):"unknown"),
     accepts_free_submissions:false,
     activity_status:"unknown",source_name:"Public Web Search (Bing RSS / Google News RSS / DuckDuckGo)",
     source_url:url,evidence_url:page.ok?finalUrl:null,first_seen_at:now(),last_checked_at:now(),review_status:"pending"};
    await rest("opportunity_discovery_candidates",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(candidate)});
    queued++;queuedDetails.push({category:item.category,name,source_url:url,submission_url:candidate.submission_url,contact_email:email});
   }
  }catch(e){errors.push(item.category+": "+e.message);}
 }
 const status=errors.length?(done?"partial":"failed"):"completed";
 await rest("hourly_opportunity_discovery_runs?id=eq."+runId,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({
  finished_at:now(),status,searches_run:done,candidates_seen:seen,records_added:0,records_updated:0,
  records_rejected:rejected,error_summary:errors.join(" | ").slice(0,3000)||null})});
 console.log(JSON.stringify({runId,status,searchesRun:done,candidatesSeen:seen,candidatesQueued:queued,recordsPublished:0,recordsRejected:rejected,duplicatesSkipped:duplicates,unaccounted:Math.max(0,seen-queued-rejected-duplicates),duplicateDetails,rejectedDetails,queuedDetails,errors},null,2));
 if(!done)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
