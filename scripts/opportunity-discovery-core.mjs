const MULTI_LABEL_SUFFIXES=new Set([
 "co.uk","org.uk","ac.uk","gov.uk","com.au","net.au","org.au","co.nz","org.nz",
 "co.za","org.za","com.br","com.mx","com.ar","com.tr","com.ng","com.gh","co.ke",
 "co.ug","co.tz","co.in","co.jp","co.kr","com.sg","com.my","com.ph","com.pk"
]);
const BLOCKED_HOSTS=new Set(["localhost","metadata.google.internal","metadata.google","instance-data"]);
function stripTags(s){return String(s||"").replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/\s+/g," ").trim();}

function decodeXml(value){
 return String(value||"")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
  .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'")
  .replace(/&lt;/g,"<").replace(/&gt;/g,">")
  .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
}

export function parseGoogleNewsRss(xml){
 const source=String(xml||"");
 const items=[];
 for(const match of source.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){
  const block=match[1];
  const read=name=>{
   const open="<"+name+">",close="</"+name+">";
   const start=block.toLowerCase().indexOf(open.toLowerCase());
   if(start<0)return "";
   const end=block.toLowerCase().indexOf(close.toLowerCase(),start+open.length);
   return end<0?"":decodeXml(block.slice(start+open.length,end).trim());
  };
  const title=read("title"),url=read("link"),description=read("description");
  const publishedAt=read("pubDate")||null;
  if(title&&isSafePublicHttpUrl(url))items.push({title,url,description,publishedAt});
 }
 return items;
}

export function hostnameOf(value){
 try{return new URL(value).hostname.toLowerCase().replace(/^\[|\]$/g,"").replace(/^www\./,"");}
 catch{return "";}
}

export function registrableDomain(value){
 const host=hostnameOf(value)||String(value||"").toLowerCase().replace(/^www\./,"");
 const labels=host.split(".").filter(Boolean);
 if(labels.length<2)return host;
 const lastTwo=labels.slice(-2).join(".");
 return MULTI_LABEL_SUFFIXES.has(lastTwo)&&labels.length>=3?labels.slice(-3).join("."):lastTwo;
}

function isPrivateIpv4(host){
 const parts=host.split(".").map(Number);
 if(parts.length!==4||parts.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
 const [a,b]=parts;
 return a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127);
}

export function isSafePublicHttpUrl(value){
 try{
  const u=new URL(value);
  if(!["http:","https:"].includes(u.protocol)||u.username||u.password)return false;
  const host=u.hostname.toLowerCase().replace(/^\[|\]$/g,"");
  if(!host||BLOCKED_HOSTS.has(host)||host.endsWith(".localhost")||host.endsWith(".local")||host.endsWith(".internal"))return false;
  if(host.includes(":")||isPrivateIpv4(host)||/^\d+(?:\.\d+)*$/.test(host)||/^0x[0-9a-f]+$/i.test(host))return false;
  return true;
 }catch{return false;}
}

export function extractSubmissionRoute(html,baseUrl){
 const source=String(html||"");
 const intent=/(submit|submission|pitch|demo|upload|send music|artist music|music submission)/i;
 const musicContext=/(music|artist|track|playlist|demo|audio|release)/i;
 for(const match of source.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)){
  const attrs=match[1]||"",body=match[2]||"",context=(attrs+" "+body.replace(/<[^>]*>/g," ")).replace(/\s+/g," ");
  if(!intent.test(context)||!musicContext.test(context))continue;
  const action=attrs.match(/\baction\s*=\s*["']([^"']*)["']/i);
  try{
   const target=new URL(action?.[1]||baseUrl,baseUrl);
   if(isSafePublicHttpUrl(target.toString()))return {url:target.toString(),method:"form"};
  }catch{}
 }
 for(const match of source.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const attrs=match[1]||"",label=(match[2]||"").replace(/<[^>]*>/g," ");
  const href=attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
  if(!href||!intent.test(label+" "+href[1])||!musicContext.test(label+" "+href[1]))continue;
  try{
   const target=new URL(href[1],baseUrl);
   if(isSafePublicHttpUrl(target.toString()))return {url:target.toString(),method:"portal"};
  }catch{}
 }
 try{
  const path=new URL(baseUrl);
  if(/\/(submit|submissions|pitch|demo|upload)(\/|$)/i.test(path.pathname)&&intent.test(source)&&musicContext.test(source))
   return {url:path.toString(),method:"form"};
 }catch{}
 return null;
}


export function extractPlaylistName(html,playlistUrl,pageTitle=""){
 const match=String(playlistUrl||"").match(/\/playlist\/([A-Za-z0-9]+)/i);
 if(!match)return "";
 const id=match[1];
 const source=String(html||"").replace(/\\\//g,"/").replace(/\\u002f/gi,"/").replace(/&amp;/g,"&");
 const anchorPattern=/<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
 for(const anchor of source.matchAll(anchorPattern)){
  const href=anchor[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]||"";
  if(!href.includes(id))continue;
  const label=stripTags(anchor[2]).replace(/\s*(?:\||–|-)\s*(?:listen on spotify|spotify|listen now)\s*$/i,"").trim();
  if(label.length>=4&&!/^(spotify|listen|listen now|listen on spotify|view on spotify|open spotify|play on spotify|playlist|music playlist|submit music|submit your music|music submission|submit here)$/i.test(label))return label.slice(0,160);
 }

 return "";
}

export function parseDataForSeoResults(data){
 if(data?.status_code!==20000||!Array.isArray(data.tasks)||data.tasks[0]?.status_code!==20000||!Array.isArray(data.tasks[0]?.result))
  throw new Error("DataForSEO task response was not successful");
 const task=data.tasks[0];
 const items=task.result.flatMap(group=>group.items||[])
  .filter(item=>item.type==="organic"&&isSafePublicHttpUrl(item.url))
  .map(item=>({title:String(item.title||""),url:String(item.url||""),description:String(item.description||""),pageAge:item.timestamp||null}));
 return {items,cost:Number(task.cost||data.cost||0),statusCode:task.status_code};
}

export function qualifiesPlaylist({playlistUrl,followerCount,responseRate,activityStatus,submissionUrl}){
 const failures=[];
 if(!/^https:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]+(?:[/?#].*)?$/i.test(String(playlistUrl||"")))failures.push("individual public Spotify playlist URL missing");
 if(!Number.isFinite(Number(followerCount))||Number(followerCount)<=100)failures.push("follower count must be greater than 100");
 if(activityStatus!=="active")failures.push("active status not explicitly confirmed");
 if(!Number.isFinite(Number(responseRate))||Number(responseRate)<0.5||Number(responseRate)>100)failures.push("response rate must be between 0.5% and 100%");
 if(!isSafePublicHttpUrl(submissionUrl)||!/^https:\/\//i.test(String(submissionUrl||"")))failures.push("HTTPS submission route not independently identified");
 return {ok:failures.length===0,failures,score:failures.length===0?100:0};
}
