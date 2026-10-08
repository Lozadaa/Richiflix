// Shared Xtream parser and client. Catalogues use opaque URLs, never credentials.
import {youtubeID,spanishMetadata} from './metadata.js';
import {eventInstant} from './eventTime.js';
import {cooperativeMap} from './cooperativeWork.js';
import {isPornographic,isPornographicCategory,CONTENT_POLICY_VERSION} from './contentPolicy.js';
import {cleanName} from './displayNames.js';
const text=value=>typeof value==='string'?value:typeof value==='number'?String(value):'';
const id=value=>/^\d{1,20}$/.test(text(value))?text(value):null;
const extension=value=>/^[a-z0-9]{1,10}$/i.test(text(value))?text(value).toLowerCase():'mp4';

export function validateAccount(input){
 let address;try{address=new URL(input.host);}catch{throw Error('Revisa la dirección del servidor.');}
 if(!['http:','https:'].includes(address.protocol)||address.username||address.password||address.search||address.hash)throw Error('Usa un servidor HTTP o HTTPS sin credenciales en la dirección.');
 const username=text(input.username).trim(),password=text(input.password),name=text(input.name).trim()||'eterboxtv';
 if(!username||!password||username.length>200||password.length>300)throw Error('Introduce usuario y contraseña.');
 return {name:name.slice(0,80),host:address.href.replace(/\/$/,''),username,password};
}
export function accountKey(account){let hash=2166136261;for(const char of account.host+'|'+account.username)hash=Math.imul(hash^char.charCodeAt(0),16777619);return (hash>>>0).toString(36);}

export async function requestXtream(account,action,params={},fetcher=fetch,timeout=45000){
 const url=new URL(account.host+'/player_api.php');url.searchParams.set('username',account.username);url.searchParams.set('password',account.password);
 if(action)url.searchParams.set('action',action);for(const [key,value] of Object.entries(params))url.searchParams.set(key,String(value));
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);let reader;
 try{
  const response=await fetcher(url.href,{signal:controller.signal});if(!response.ok)throw Error(`El servidor respondió HTTP ${response.status}.`);
  reader=response.body.getReader();const chunks=[];let bytes=0;
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>64*1024*1024)throw Error('El catálogo supera el tamaño admitido.');chunks.push(value);}
  const data=new Uint8Array(bytes);let at=0;for(const chunk of chunks){data.set(chunk,at);at+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder().decode(data));}catch{throw Error('El servidor no devolvió un catálogo Xtream válido.');}
 }catch(error){
  if(/^El servidor|^El catálogo/.test(error.message))throw error;
  throw Error('No se pudo conectar al servidor Xtream.');
 }finally{clearTimeout(timer);await reader?.cancel().catch(()=>{});}
}
export async function authenticate(account,fetcher=fetch){
 const data=await requestXtream(account,null,{},fetcher),user=data?.user_info;
 if(Number(user?.auth)!==1)throw Error('Usuario o contraseña no válidos.');
 if(user.status&&user.status!=='Active')throw Error('La cuenta Xtream no está activa.');
 return {name:account.name,host:account.host,key:accountKey(account),formats:Array.isArray(user.allowed_output_formats)?user.allowed_output_formats:[],status:'Active'};
}

function imageURL(value,account){
 try{const address=new URL(text(value));if(!['https:','http:'].includes(address.protocol))return undefined;
  if(address.username||address.password||['username','password'].some(key=>address.searchParams.has(key))||address.href.includes(account.password)||address.href.includes(encodeURIComponent(account.password)))return undefined;
  return address.href;
 }catch{return undefined;}
}
export function normaliseItem(raw,type,categories,account){
 const streamId=id(type==='series'?raw.series_id:raw.stream_id??raw.id);if(!streamId)return null;
 const suffix=type==='live'?'m3u8':extension(raw.container_extension),key=accountKey(account);
 const category=categories.get(text(raw.category_id))||({live:'TV en vivo',movie:'Películas',series:'Series',episode:'Episodios'})[type];
 if(isPornographic({...raw,title:raw.name||raw.title,category,mediaType:type}))return null;
 const clock=type==='episode'&&/^\d{1,2}:[0-5]\d:[0-5]\d$/.test(text(raw.info?.duration))?text(raw.info.duration).split(':').map(Number):null;
 const suppliedDuration=Number(raw.info?.duration_secs)||(type==='episode'?Number(raw.duration_secs)|| (clock?clock[0]*3600+clock[1]*60+clock[2]:0):0);
 const durationSeconds=Number.isFinite(suppliedDuration)&&suppliedDuration>0?suppliedDuration:0;
 return {id:`xt-${key}-${type}-${streamId}`,url:`xtream://${key}/${type}/${streamId}.${suffix}`,streamId,mediaType:type,extension:suffix,kind:type==='live'?'iptv':type==='series'?'series':'vod',sourceId:account.sourceId||'eterboxtv',source:account.name,credit:account.name,
  tmdbId:/^\d{1,10}$/.test(String(raw.tmdb_id||raw.info?.tmdb_id||''))?String(raw.tmdb_id||raw.info?.tmdb_id):undefined,
  title:text(raw.name||raw.title)||`${category} ${streamId}`,genre:category,contentGenre:text(raw.genre||raw.info?.genre),category,year:text(raw.year),image:imageURL(raw.stream_icon||raw.cover||raw.info?.movie_image,account),eventStartsAt:type==='live'?eventInstant(raw.event_start_timestamp??raw.start_timestamp??raw.event_start??raw.start_time):undefined,
  description:text(raw.plot||raw.info?.plot||raw.info?.description).slice(0,5000)||(type==='live'?`${account.name} · En vivo`:''),trailerId:youtubeID(raw.youtube_trailer||raw.info?.youtube_trailer),durationSeconds,duration:durationSeconds?`${Math.round(durationSeconds/60)} min`:undefined};
}
export async function loadXtreamCatalogue(account,fetcher=fetch,workOptions){
 const connection=await authenticate(account,fetcher),result={};
 // Two metadata requests at a time avoid overwhelming provider panels.
 for(const type of ['live','movie','series']){
  const stem=type==='movie'?'vod':type,action=type==='series'?'get_series':`get_${stem}_streams`;
  const [categories,items]=await Promise.all([requestXtream(account,`get_${stem}_categories`,{},fetcher),requestXtream(account,action,{},fetcher)]);
  if(!Array.isArray(categories)||!Array.isArray(items))throw Error('El servidor no devolvió el catálogo completo.');
  const map=new Map(categories.map(category=>[text(category.category_id),text(category.category_name)]));
  const blocked=new Set(categories.filter(isPornographicCategory).map(category=>text(category.category_id)));
  result[type]=(await cooperativeMap(items,item=>[item.category_id,...(Array.isArray(item.category_ids)?item.category_ids:[])].some(value=>blocked.has(text(value)))?null:normaliseItem(item,type,map,account),workOptions)).filter(Boolean);
 }
 return {connection,channels:result.live,movies:result.movie,shows:result.series,contentPolicyVersion:CONTENT_POLICY_VERSION,updatedAt:new Date().toISOString()};
}
export async function loadXtreamEpisodes(account,seriesId,fetcher=fetch){
 if(!id(seriesId))throw Error('Serie no válida.');
 const data=await requestXtream(account,'get_series_info',{series_id:seriesId},fetcher),groups=data?.episodes;
 if(isPornographic(data?.info))return [];
 if(!groups||typeof groups!=='object')throw Error('No se encontraron episodios de esta serie.');
 return Object.entries(groups).sort(([a],[b])=>Number(a)-Number(b)).map(([season,episodes])=>({season,episodes:(Array.isArray(episodes)?episodes:[]).map(raw=>{
  const item=normaliseItem({...raw,name:raw.title||raw.name},'episode',new Map(),account);if(!item)return null;const clean=cleanName(item.title,{kind:'episode',series:data.info?.name||data.info?.title});return {...item,...clean,title:clean.title,displayTitle:clean.title,originalTitle:item.title,episodeNumber:Number(raw.episode_num)||clean.episodeNumber||0,season};
 }).filter(Boolean).sort((a,b)=>a.episodeNumber-b.episodeNumber)}));
}
export async function loadXtreamVideoDetails(account,streamId,fetcher=fetch,type='movie',metadataToken=''){
 if(!id(streamId))throw Error('Película no válida.');
 const series=type==='series';
 const data=await requestXtream(account,series?'get_series_info':'get_vod_info',{[series?'series_id':'vod_id']:streamId},fetcher,10000),info=data?.info||{};
 if(isPornographic(info)||isPornographic(data?.movie_data))return {isPornographic:true};
 const description=text(info.plot||info.description).slice(0,5000),contentGenre=text(info.genre);
 const backdropImage=imageURL(Array.isArray(info.backdrop_path)?info.backdrop_path[0]:info.backdrop_path,account),trailerId=youtubeID(info.youtube_trailer);
 const durationSeconds=Number(info.duration_secs),year=text(info.releasedate||info.release_date).slice(0,4);
 const cast=text(info.cast||info.actors).slice(0,500),director=text(info.director).slice(0,200);
 // Absent detail fields must not replace usable catalogue metadata with blanks.
 return {...(description?{description}:{}),...(contentGenre?{contentGenre}:{}),
  ...(backdropImage?{backdropImage}:{}),...(trailerId?{trailerId}:{}),
  ...(Number.isFinite(durationSeconds)&&durationSeconds>0?{durationSeconds}:{}),...(year?{year}:{}),
  ...(cast?{cast}:{}),...(director?{director}:{}),...await spanishMetadata(info.tmdb_id,series?'series':'movie',metadataToken,fetcher)};
}
// Fase L4: «ahora y después» of one channel. Only the fields the guide shows cross the worker/IPC
// boundary; titles stay base64 until parseShortEpg (channelGuide.js). Errors never carry the URL.
export async function loadXtreamShortEpg(account,streamId,fetcher=fetch){
 if(!id(streamId))throw Error('Canal no válido.');
 const data=await requestXtream(account,'get_short_epg',{stream_id:streamId,limit:2},fetcher,6000),list=Array.isArray(data?.epg_listings)?data.epg_listings:[];
 return {epg_listings:list.slice(0,4).map(entry=>({title:text(entry?.title).slice(0,1000),start:text(entry?.start).slice(0,40),end:text(entry?.end).slice(0,40),start_timestamp:text(entry?.start_timestamp).slice(0,20),stop_timestamp:text(entry?.stop_timestamp).slice(0,20),now_playing:Number(entry?.now_playing)===1?1:0}))};
}
export function playbackURL(account,item,formats=['m3u8']){
 if(isPornographic(item))throw Error('Este contenido está bloqueado en Kingdom.');
 const streamId=id(item.streamId),type=item.mediaType;if(!streamId||!['live','movie','episode'].includes(type))throw Error('Vídeo no válido.');
 const folder=type==='episode'?'series':type,format=type==='live'?(formats.includes('m3u8')?'m3u8':'ts'):extension(item.extension);
 return `${account.host}/${folder}/${encodeURIComponent(account.username)}/${encodeURIComponent(account.password)}/${streamId}.${format}`;
}
