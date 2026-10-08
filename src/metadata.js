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
// Title logo: TMDB path of the first Spanish logo, else the first without language; PNG before SVG within each group.
export function pickLogo(images){
 const logos=Array.isArray(images?.logos)?images.logos.filter(logo=>typeof logo?.file_path==='string'&&/^\/[\w.-]+\.(?:png|svg)$/i.test(logo.file_path)):[];
 for(const language of ['es',null]){const group=logos.filter(logo=>logo.iso_639_1===language),logo=group.find(logo=>/\.png$/i.test(logo.file_path))||group[0];if(logo)return logo.file_path;}
}
export async function spanishMetadata(tmdbId,type,token,fetcher=fetch){
 if(!token||!/^\d{1,10}$/.test(String(tmdbId)))return {};
 try{
  // Video languages are independent of the Spanish title and synopsis. Fetch
  // English fallbacks with the same request instead of another network round trip.
  const data=await tmdbRequest(`${type==='series'?'tv':'movie'}/${tmdbId}?append_to_response=videos,images,${type==='series'?'content_ratings':'release_dates'}&include_image_language=es,null&include_video_language=es,en,null`,token,fetcher);
  if(data.adult===true)return {isPornographic:true};
  const languageRank=video=>video.iso_639_1==='es'?0:video.iso_639_1==='en'?1:video.iso_639_1==null||video.iso_639_1===''?2:3;
  const videos=Array.isArray(data.videos?.results)?data.videos.results:[];
  const trailer=videos.filter(video=>video&&video.site==='YouTube'&&video.type==='Trailer'&&languageRank(video)<3&&youtubeID(video.key))
   .sort((a,b)=>languageRank(a)-languageRank(b)||Number(Boolean(b.official))-Number(Boolean(a.official)))[0];
  const logoImage=pickLogo(data.images);
  return {...tmdbRating(data),ageClassification:tmdbAgeClassification(data,type,tmdbId),tmdbId:String(tmdbId),...(Array.isArray(data.genres)?{tmdbGenres:data.genres.map(genre=>genre.name).filter(name=>typeof name==='string'),contentGenre:data.genres.map(genre=>genre.name).filter(name=>typeof name==='string').join(', ')}:{}),...(data.overview?.trim()?{description:data.overview.slice(0,5000),descriptionLanguage:'es'}:{}),
   ...(data.title||data.name?{localizedTitle:data.title||data.name}:{}),
   ...(data.backdrop_path?{backdropImage:`https://image.tmdb.org/t/p/original${data.backdrop_path}`} :{}),
   ...(logoImage?{logoImage}:{}),
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
// Titles missing from the catalogue: search/multi in es-ES, movies and series only,
// with Spanish genre names from TMDB's lists (fetched once per token).
const genreLists=new WeakMap();
function tmdbGenres(token,fetcher){
 let byToken=genreLists.get(fetcher);if(!byToken)genreLists.set(fetcher,byToken=new Map());
 if(!byToken.has(token))byToken.set(token,Promise.all(['movie','tv'].map(type=>tmdbRequest(`genre/${type}/list`,token,fetcher))).then(lists=>new Map(lists.flatMap(list=>Array.isArray(list?.genres)?list.genres:[]).filter(genre=>Number.isSafeInteger(genre?.id)&&typeof genre.name==='string').map(genre=>[genre.id,genre.name]))).catch(()=>{byToken.delete(token);return new Map();}));
 return byToken.get(token);
}
export async function tmdbSearch(query,token,fetcher=fetch){
 const text=String(query||'').trim().slice(0,100);if(!token||text.length<2)return [];
 try{
  const [data,genres]=await Promise.all([tmdbRequest(`search/multi?query=${encodeURIComponent(text)}&include_adult=false&page=1`,token,fetcher),tmdbGenres(token,fetcher)]);
  return (Array.isArray(data?.results)?data.results:[]).filter(entry=>['movie','tv'].includes(entry?.media_type)&&entry.adult!==true&&/^\d{1,10}$/.test(String(entry.id))&&(entry.title||entry.name)).slice(0,10).map(entry=>{
   const genreIds=Array.isArray(entry.genre_ids)?entry.genre_ids.filter(Number.isSafeInteger):[];
   return {tmdbId:String(entry.id),type:entry.media_type==='tv'?'series':'movie',title:String(entry.title||entry.name).slice(0,300),originalTitle:String(entry.original_title||entry.original_name||'').slice(0,300),year:String(entry.release_date||entry.first_air_date||'').slice(0,4),genreIds,genres:genreIds.map(id=>genres.get(id)).filter(Boolean),poster:typeof entry.poster_path==='string'&&/^\/[\w.-]+$/.test(entry.poster_path)?`https://image.tmdb.org/t/p/w342${entry.poster_path}`:undefined};
  });
 }catch{return [];}
}
