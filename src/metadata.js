import {tmdbAgeClassification} from './ageClassification.js';
export function youtubeID(value){
 if(typeof value!=='string')return undefined;
 if(/^[\w-]{11}$/.test(value))return value;
 try{const url=new URL(value);if(!['https:','http:'].includes(url.protocol))return undefined;
  const host=url.hostname.replace(/^www\./,'');
  const candidate=host==='youtu.be'?url.pathname.slice(1):['youtube.com','m.youtube.com','youtube-nocookie.com'].includes(host)?url.searchParams.get('v')||url.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})$/)?.[1]:null;
  return /^[\w-]{11}$/.test(candidate||'')?candidate:undefined;
 }catch{return undefined;}
}
export function validateMetadataToken(value){
 const token=String(value||'').trim().replace(/^Bearer\s+/i,'');
 if(token&&!/^[a-zA-Z0-9_.-]{20,2500}$/.test(token))throw Error('Introduce una API key o un token de lectura válido de TMDB.');
 return token;
}
export async function tmdbRequest(path,token,fetcher,language='es-ES'){
 const url=new URL('https://api.themoviedb.org/3/'+path);url.searchParams.set('language',language);
 const headers={};if(/^[a-f0-9]{32}$/i.test(token))url.searchParams.set('api_key',token);else headers.Authorization='Bearer '+token;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try{const response=await fetcher(url.href,{headers,signal:controller.signal});if(!response.ok)throw Error('No se pudo consultar TMDB.');return await response.json();}
 catch{throw Error('No se pudo consultar TMDB. Revisa el token y la conexión.');}finally{clearTimeout(timer);}
}
export async function checkMetadataToken(token,fetcher=fetch){
 if(!token)return;await tmdbRequest('configuration',validateMetadataToken(token),fetcher);
}
export function tmdbRating(data){
 const score=Number(data.vote_average),votes=Number(data.vote_count);
 return Number.isFinite(score)&&score>0&&score<=10&&Number.isSafeInteger(votes)&&votes>0?{tmdbScore:score,tmdbVotes:votes}:{};
}
export async function spanishMetadata(tmdbId,type,token,fetcher=fetch){
 if(!token||!/^\d{1,10}$/.test(String(tmdbId)))return {};
 try{
  // Video languages are independent of the Spanish title and synopsis. Fetch
  // English fallbacks with the same request instead of another network round trip.
  const data=await tmdbRequest(`${type==='series'?'tv':'movie'}/${tmdbId}?append_to_response=videos,${type==='series'?'content_ratings':'release_dates'}&include_video_language=es,en,null`,token,fetcher);
  if(data.adult===true)return {isPornographic:true};
  const languageRank=video=>video.iso_639_1==='es'?0:video.iso_639_1==='en'?1:video.iso_639_1==null||video.iso_639_1===''?2:3;
  const videos=Array.isArray(data.videos?.results)?data.videos.results:[];
  const trailer=videos.filter(video=>video&&video.site==='YouTube'&&video.type==='Trailer'&&languageRank(video)<3&&youtubeID(video.key))
   .sort((a,b)=>languageRank(a)-languageRank(b)||Number(Boolean(b.official))-Number(Boolean(a.official)))[0];
  return {...tmdbRating(data),ageClassification:tmdbAgeClassification(data,type,tmdbId),tmdbId:String(tmdbId),...(Array.isArray(data.genres)?{tmdbGenres:data.genres.map(genre=>genre.name).filter(name=>typeof name==='string'),contentGenre:data.genres.map(genre=>genre.name).filter(name=>typeof name==='string').join(', ')}:{}),...(data.overview?.trim()?{description:data.overview.slice(0,5000),descriptionLanguage:'es'}:{}),
   ...(data.title||data.name?{localizedTitle:data.title||data.name}:{}),
   ...(data.backdrop_path?{backdropImage:`https://image.tmdb.org/t/p/original${data.backdrop_path}`} :{}),
   ...(data.poster_path?{image:`https://image.tmdb.org/t/p/w780${data.poster_path}`} :{}),
   ...(trailer?{trailerId:youtubeID(trailer.key)}:{}),metadataCredit:'TMDB'};
 }catch{return {};}
}
// Episode titles and synopses for one season: es-ES, then es-MX for the gaps
// and English synopses only as a marked last resort. Kept 30 days per season.
export async function tmdbSeason(tmdbId,season,token,fetcher=fetch,cache){
 if(!token||!/^\d{1,10}$/.test(String(tmdbId))||!/^\d{1,3}$/.test(String(season)))return [];
 const key=`season:${tmdbId}:${Number(season)}`,cached=await cache?.get(key);if(Array.isArray(cached?.seasonEpisodes))return cached.seasonEpisodes;
 const load=async language=>{const data=await tmdbRequest(`tv/${tmdbId}/season/${Number(season)}`,token,fetcher,language);return new Map((Array.isArray(data?.episodes)?data.episodes:[]).filter(entry=>Number.isSafeInteger(entry?.episode_number)).map(entry=>[entry.episode_number,entry]));};
 const text=value=>typeof value==='string'?value.trim():'';
 try{
  const spanish=await load('es-ES'),missing=()=>[...spanish.values()].filter(entry=>!text(entry.name)||!text(entry.overview));
  if(missing().length){const mexican=await load('es-MX');for(const entry of missing()){const other=mexican.get(entry.episode_number);if(!text(entry.name)&&text(other?.name))entry.name=other.name;if(!text(entry.overview)&&text(other?.overview))entry.overview=other.overview;}}
  if(missing().some(entry=>!text(entry.overview))){const english=await load('en-US').catch(()=>new Map());for(const entry of missing()){const other=english.get(entry.episode_number);if(!text(entry.overview)&&text(other?.overview))Object.assign(entry,{overview:other.overview,overviewLanguage:'en'});}}
  const episodes=[...spanish.values()].map(({episode_number,season_number,name,overview,overviewLanguage,air_date,runtime,still_path})=>Object.fromEntries(Object.entries({episode_number,season_number,name:text(name).slice(0,300),overview:text(overview).slice(0,5000),overviewLanguage,air_date,runtime,still_path}).filter(([,value])=>value!==undefined&&value!==null)));
  await cache?.put(key,{seasonEpisodes:episodes});return episodes;
 }catch{return [];}
}
