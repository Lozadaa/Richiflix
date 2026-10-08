import {tmdbRequest,tmdbRating} from './metadata.js';
import {cooperativeForEach} from './cooperativeWork.js';
import {buildDiscoveryCollections} from './discoveryCollections.js';
const ttl=24*60*60*1000;
export const TMDB_BEST='Mejor valoradas · TMDB';
export const TMDB_RECENT='Mejor valoradas de los últimos 12 meses · TMDB';
const imagePath=(path,size)=>typeof path==='string'&&/^\/[a-zA-Z0-9_.-]+\.(?:jpg|png|webp)$/.test(path)?`https://image.tmdb.org/t/p/${size}${path}`:undefined;
const clean=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const titleKey=item=>{let value=String(item.localizedTitle||item.title||'').trim(),previous;do{previous=value;value=value.replace(/\s*\((?:\d{4}|LAT(?:INO)?(?:\s*\/\s*ENG)?|ENG|DUAL|SUB(?:S|TITULADO)?|HD|FHD|4K)\)\s*$/i,'').replace(/\s*\[(?:HD|FHD|4K)\]\s*$/i,'').trim();}while(previous!==value);return clean(value);};
const year=item=>String(item.year||item.title?.match(/\((\d{4})\)/)?.[1]||'').slice(0,4);
export function createTmdbSelectionCache({read=async()=>null,write=async()=>{},fetcher=fetch,now=Date.now,pages=3,recentPages=2}={}){
 let pending;
 return {async get(token,tokenKey){
  if(!token)return {status:'unconfigured',movies:[],shows:[],genres:{movies:[],shows:[]}};
  if(pending?.key===tokenKey)return pending.work;
  const work=(async()=>{
   let saved;try{saved=await read();}catch{}
   const valid=saved?.tokenKey===tokenKey&&Array.isArray(saved.movies)&&Array.isArray(saved.shows)&&saved.genres&&Number.isFinite(saved.updatedAt)&&saved.updatedAt<=now()+60000;
   if(valid&&saved.version===2&&Array.isArray(saved.recentMovies)&&Array.isArray(saved.recentShows)&&now()-saved.updatedAt<ttl)return {...saved,status:'ready'};
   const date=new Date(now()),end=date.toISOString().slice(0,10);date.setUTCFullYear(date.getUTCFullYear()-1);const start=date.toISOString().slice(0,10);
   const result={version:2,tokenKey,updatedAt:now(),movies:[],shows:[],recentMovies:[],recentShows:[],recentStart:start,recentEnd:end,genres:{movies:[],shows:[]}},jobs=[];let failures=0;
   const append=(data,key,page,recent=false)=>{if(!Array.isArray(data.results))throw Error('Lista no disponible');for(const [index,item]of data.results.entries()){const release=String(item.release_date||item.first_air_date||'');if(!/^\d{1,10}$/.test(String(item.id))||!tmdbRating(item).tmdbScore||recent&&(!/^\d{4}-\d{2}-\d{2}$/.test(release)||release<start||release>end||item.vote_count<(key==='recentMovies'?200:100)))continue;result[key].push({id:String(item.id),title:item.title||item.name,originalTitle:item.original_title||item.original_name,year:release.slice(0,4),backdropImage:imagePath(item.backdrop_path,'original'),image:imagePath(item.poster_path,'w780'),genreIds:Array.isArray(item.genre_ids)?item.genre_ids:[],rank:(page-1)*20+index+1,...tmdbRating(item)});}};
   for(const [type,key] of [['movie','movies'],['tv','shows']]){
    jobs.push(async()=>{const data=await tmdbRequest(`genre/${type}/list`,token,fetcher);result.genres[key]=Array.isArray(data.genres)?data.genres:[];});
    for(let page=1;page<=pages;page++)jobs.push(async()=>{
     append(await tmdbRequest(`${type}/top_rated?page=${page}`,token,fetcher),key,page);
    });
    for(let page=1;page<=recentPages;page++)jobs.push(async()=>{const recentKey=type==='movie'?'recentMovies':'recentShows',dateKey=type==='movie'?'primary_release_date':'first_air_date',path=`discover/${type}?sort_by=vote_average.desc&vote_count.gte=${type==='movie'?200:100}&${dateKey}.gte=${start}&${dateKey}.lte=${end}&include_adult=false&page=${page}`;append(await tmdbRequest(path,token,fetcher),recentKey,page,true);});
   }
   let next=0;await Promise.all(Array.from({length:2},async()=>{while(next<jobs.length){const job=jobs[next++];try{await job();}catch{failures++;}}}));
   for(const key of ['movies','shows','recentMovies','recentShows']){result[key].sort((a,b)=>a.rank-b.rank);const seen=new Set();result[key]=result[key].filter(item=>!seen.has(item.id)&&seen.add(item.id));}
   // Partial/offline results never overwrite a complete cache.
   if(failures&&valid)return {...saved,status:'ready',stale:true};
   if(!result.movies.length&&!result.shows.length&&!result.recentMovies.length&&!result.recentShows.length)return {...result,status:'unavailable'};
   if(!failures)try{await write(result);}catch{}
   return {...result,status:'ready',partial:Boolean(failures)};
  })();pending={key:tokenKey,work};try{return await work;}finally{if(pending?.work===work)pending=null;}
 }};
}
export async function matchTmdbSelections(catalogue,rankings,options={budget:2,batchSize:128}){
 const metadata={},collections=[];
 for(const [key,type]of [['movies','movie'],['shows','series']]){
  const overall=rankings[key]||[],recent=rankings[key==='movies'?'recentMovies':'recentShows']||[],overallIds=new Map(overall.map(item=>[item.id,item])),recentIds=new Map(recent.map(item=>[item.id,item])),ranked=[...new Map([...recent,...overall].map(item=>[item.id,item])).values()],byId=new Map(ranked.map(item=>[item.id,item])),byTitle=new Map(),genreNames=new Map((rankings.genres?.[key]||[]).filter(genre=>genre&&typeof genre.name==='string').map(genre=>[genre.id,genre.name]));
  for(const record of ranked)for(const title of new Set([record.title,record.originalTitle].map(clean).filter(Boolean))){if(!byTitle.has(title))byTitle.set(title,[]);byTitle.get(title).push(record);}
  const matched=new Map();
  await cooperativeForEach(catalogue[key]||[],item=>{
   if(item.mediaType!==type)return;
   let record;
   if(item.tmdbId)record=byId.get(String(item.tmdbId));
   else{
    const candidates=new Map();for(const title of new Set([titleKey(item),clean(item.localizedTitle)]))for(const value of byTitle.get(title)||[])candidates.set(value.id,value);
    const itemYear=year(item),possible=[...candidates.values()].filter(value=>!itemYear||value.year===itemYear);if(possible.length===1)record=possible[0];
   }
   if(!record)return;
   const genres=record.genreIds.map(id=>genreNames.get(id)).filter(Boolean);
   const release=record.year||recentIds.get(record.id)?.year;
   metadata[item.id]={tmdbId:record.id,tmdbScore:record.tmdbScore,tmdbVotes:record.tmdbVotes,...(overallIds.has(record.id)?{tmdbRank:overallIds.get(record.id).rank}:{}),tmdbGenres:genres,...(release?{year:release}:{}),...(record.backdropImage?{backdropImage:record.backdropImage}:{}),...(record.image?{image:record.image}:{})};
   if(!matched.has(record.id))matched.set(record.id,{id:item.id,record,genres});
  },options);
  const selected=[...matched.values()].sort((a,b)=>a.record.rank-b.record.rank);
  const best=selected.filter(item=>overallIds.has(item.record.id)).sort((a,b)=>overallIds.get(a.record.id).rank-overallIds.get(b.record.id).rank),newer=selected.filter(item=>recentIds.has(item.record.id)).sort((a,b)=>recentIds.get(a.record.id).rank-recentIds.get(b.record.id).rank);
  if(best.length)collections.push({key:`ranking:${type}:best`,kind:'ranking',name:TMDB_BEST,label:'Top · TMDB',type,ids:best.map(item=>item.id)});
  if(newer.length)collections.push({key:`ranking:${type}:recent`,kind:'ranking',name:TMDB_RECENT,label:'Top reciente · TMDB',type,ids:newer.map(item=>item.id)});
  for(const genre of new Set(selected.flatMap(item=>item.genres))){const ids=selected.filter(item=>item.genres.includes(genre)).map(item=>item.id);if(ids.length>=2)collections.push({name:`Lo mejor de ${genre} · TMDB`,type,ids});}
 }
 collections.push(...await buildDiscoveryCollections(catalogue,metadata,Date.now(),options));
 return {status:rankings.status,metadata,collections,updatedAt:rankings.updatedAt,stale:rankings.stale||false,partial:rankings.partial||false};
}
