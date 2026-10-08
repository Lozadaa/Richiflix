// D4 · level 1: TheIntroDB (community, keyless reads, CORS, 30 requests / 10 s) by TMDB id + season + episode.
// Checked 8 oct 2026: GET https://api.theintrodb.org/v2/media → {intro:[{start_ms,end_ms}],recap:[…],credits:[…]}.
// Never throws: any failure means "no data" and the learned level takes over. Answers are cached 30 days.
const CACHE_KEY='rf-intro-db-v1',TTL=30*86400000,LIMIT=300;
const read=storage=>{try{return JSON.parse(storage.getItem(CACHE_KEY))||{};}catch{return {};}};
const segment=(kind,list)=>{const entry=(Array.isArray(list)?list:[]).find(item=>Number.isFinite(item?.end_ms));return entry?{kind,start:(Number(entry.start_ms)||0)/1000,end:entry.end_ms/1000}:null;};
export async function fetchIntro({tmdbId,season,episode},{fetcher=globalThis.fetch,storage=globalThis.localStorage,now=Date.now,timeout=4000}={}){
 const id=Number(tmdbId),number=Number(episode);if(!Number.isInteger(id)||id<1||!(Number(season)>0)||!(number>0))return [];
 const key=`${id}:${Number(season)}:${number}`,cache=read(storage),hit=cache[key];
 if(hit&&now()-hit.at<TTL)return hit.segments;
 const controller=typeof AbortController==='function'?new AbortController():null,timer=controller&&setTimeout(()=>controller.abort(),timeout);
 try{
  const response=await fetcher(`https://api.theintrodb.org/v2/media?tmdb_id=${id}&season=${Number(season)}&episode=${number}`,controller?{signal:controller.signal}:undefined);
  if(!response.ok&&response.status!==404)return [];
  const data=response.ok?await response.json():{},segments=[segment('recap',data.recap),segment('intro',data.intro)].filter(Boolean);
  const next={...read(storage),[key]:{at:now(),segments}};
  try{storage.setItem(CACHE_KEY,JSON.stringify(Object.fromEntries(Object.entries(next).sort((a,b)=>b[1].at-a[1].at).slice(0,LIMIT))));}catch{}
  return segments;
 }catch{return [];}finally{clearTimeout(timer);}
}
// Absolute provider numbering (season 2 starting at 13) becomes the position inside the season, as in episodeMetadata.
export function seasonEpisodeNumber(seasons,episode){
 const numbers=(seasons?.find(group=>group.season===episode.season)?.episodes||[]).map(entry=>Number(entry.episodeNumber)||0),first=numbers.length?Math.min(...numbers):1;
 return first>1?Number(episode.episodeNumber)-first+1:Number(episode.episodeNumber);
}
