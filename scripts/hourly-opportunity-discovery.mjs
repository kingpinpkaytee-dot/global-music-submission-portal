// Hourly Google Custom Search discovery for Artist Frequency.
// Only promote records with a reachable official submission route and category-specific evidence.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_CSE_API_KEY;
const GOOGLE_CX = process.env.GOOGLE_CSE_ID;
if (![SUPABASE_URL,SERVICE_ROLE_KEY,GOOGLE_API_KEY,GOOGLE_CX].every(Boolean)) {
  throw new Error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CSE_API_KEY or GOOGLE_CSE_ID.");
}
const headers = { apikey:SERVICE_ROLE_KEY, Authorization:`Bearer ${SERVICE_ROLE_KEY}`, "Content-Type":"application/json" };
const queries = [
  {category:"playlist",q:'site:playlistdock.com/playlist.php ("submit track" OR "submit music") Spotify playlist'},
  {category:"radio_station",q:'radio station "submit music" OR "music submissions" independent artists'},
  {category:"blogger",q:'music blog "submit music" OR "submit your music" independent artists'},
  {category:"curator",q:'Spotify playlist curator "submit music" OR "submit track" open submissions'}
];
const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function rest(path, options={}) {
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...options,headers:{...headers,...options.headers}});
  const body=await r.text();
  if(!r.ok) throw new Error(`Supabase ${r.status}: ${body.slice(0,500)}`);
  return body ? JSON.parse(body) : null;
}
async function search(q) {
  const u=new URL("https://www.googleapis.com/customsearch/v1");
  u.searchParams.set("key",GOOGLE_API_KEY);u.searchParams.set("cx",GOOGLE_CX);
  u.searchParams.set("q",q);u.searchParams.set("num","10");
  const r=await fetch(u);if(!r.ok) throw new Error(`Google CSE ${r.status}: ${(await r.text()).slice(0,250)}`);
  const j=await r.json();return j.items||[];
}
async function inspect(url) {
  try {
    const r=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(12000),headers:{"User-Agent":"ArtistFrequencyOpportunityVerifier/1.0"}});
    if(!r.ok) return {ok:false,reason:`HTTP ${r.status}`};
    const type=r.headers.get("content-type")||"";
    const text=type.includes("text") ? (await r.text()).slice(0,350000) : "";
    if(type.includes("text/html") && /captcha|cloudflare challenge|access denied/i.test(text.slice(0,12000)))
      return {ok:false,reason:"Blocked by challenge; manual verification required"};
    return {ok:true,finalUrl:r.url,html:text};
  } catch(e) { return {ok:false,reason:String(e.message||e)}; }
}
function cleanName(s){return String(s||"").replace(/\s+/g," ").replace(/[|<>]/g,"").trim().slice(0,180);}
function categoryEvidence(category,title,snippet,html,url){
  const all=(title+" "+snippet+" "+html.slice(0,80000)).toLowerCase();
  const submit=/(submit music|submit your music|submit a track|submit track|music submission|send music|send us music|artist submissions|demo submission|submit here)/i.test(all);
  if(!submit) return {ok:false,reason:"No explicit music-submission evidence found"};
  const route=/<form\b|mailto:|href\s*=\s*["'][^"']*(submit|submission|demo|upload)[^"']*["']/i.test(html) || /\/(submit|submission|demo|music-upload)/i.test(url);
  if(!route) return {ok:false,reason:"No direct submission form or route found"};
  if(category==="playlist"){
    const spotify=html.match(/https?:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i) || html.match(/https?:\\\/\\\/open\.spotify\.com\\\/playlist\\\/([A-Za-z0-9]+)/i);
    if(!spotify) return {ok:false,reason:"No individual Spotify playlist URL found on source page"};
    return {ok:true,spotifyUrl:spotify[0].replace(/\\/g,"")};
  }
  if(category==="radio_station" && !/(radio|broadcast|fm|station)/i.test(all)) return {ok:false,reason:"No radio-station identity evidence"};
  if(category==="blogger" && !/(blog|magazine|editorial|music review|press)/i.test(all)) return {ok:false,reason:"No music editorial identity evidence"};
  if(category==="curator" && !/(playlist|curator|spotify)/i.test(all)) return {ok:false,reason:"No playlist-curator identity evidence"};
  return {ok:true};
}
async function main(){
  const run=await rest("hourly_opportunity_discovery_runs",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({status:"running"})});
  const runId=run[0].id;let seen=0,added=0,updated=0,rejected=0,done=0;const errors=[];
  for(const item of queries){
    try{
      const results=await search(item.q);done++;
      for(const hit of results){
        seen++;const url=hit.link;if(!url||!/^https?:\/\//i.test(url)) {rejected++;continue;}
        const checked=await inspect(url);
        let ev={ok:false,reason:checked.reason||"Unreachable"};
        if(checked.ok) ev=categoryEvidence(item.category,hit.title||"",hit.snippet||"",checked.html||"",checked.finalUrl||url);
        const name=cleanName(hit.title);
        const candidate={run_id:runId,category:item.category,name,destination_url:checked.finalUrl||url,
          submission_url:checked.ok?checked.finalUrl:null,evidence:(hit.snippet||"").slice(0,1800),
          verification_status:ev.ok?"verified":"rejected",verification_reason:ev.ok?"Reachable official source and submission evidence":ev.reason};
        await rest("hourly_opportunity_discovery_candidates",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify(candidate)});
        if(!ev.ok){rejected++;continue;}
        const record={category:item.category,name,website_url:checked.finalUrl||url,
          submission_url:checked.finalUrl||url,genres:[],is_verified:true,is_active:true,is_public:true,
          verification_evidence_url:checked.finalUrl||url,verified_at:new Date().toISOString(),
          source_name:"Google Custom Search",source_url:url,submission_method:"form",
          accepts_free_submissions:/free (submission|to submit|music submissions)|no fee/i.test(checked.html||""),activity_status:"active",first_seen_at:new Date().toISOString(),
          last_checked_at:new Date().toISOString(),source_evidence_url:url,data_confidence:"source_confirmed",
          is_integrated:false,accepts_submissions:false};
        if(item.category==="playlist") {
          record.website_url=ev.spotifyUrl;record.dsp_name="Spotify";
          record.submission_url=checked.finalUrl||url;record.accepts_free_submissions=/free submission|free to submit|no fee/i.test(checked.html||"");
        }
        const existing=await rest(`opportunity_directories?select=id&category=eq.${encodeURIComponent(item.category)}&name=eq.${encodeURIComponent(name)}&limit=1`);
        if(existing?.length){
          await rest(`opportunity_directories?id=eq.${existing[0].id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({last_checked_at:record.last_checked_at,is_active:true,is_verified:true,verification_evidence_url:record.verification_evidence_url})});updated++;
        }else{
          await rest("opportunity_directories",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify(record)});added++;
        }
      }
    }catch(e){errors.push(`${item.category}: ${e.message}`);}
    await sleep(350);
  }
  const status=errors.length?(done?"partial":"failed"):"completed";
  await rest(`hourly_opportunity_discovery_runs?id=eq.${runId}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({finished_at:new Date().toISOString(),status,searches_run:done,candidates_seen:seen,records_added:added,records_updated:updated,records_rejected:rejected,error_summary:errors.join(" | ").slice(0,3000)||null})});
  console.log(JSON.stringify({runId,status,searchesRun:done,candidatesSeen:seen,recordsAdded:added,recordsUpdated:updated,recordsRejected:rejected,errors},null,2));
  if(!done) process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});