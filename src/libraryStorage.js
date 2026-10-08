import {deviceStorage} from './deviceStorage.js';

const favorites=value=>Array.isArray(value)?[...new Set(value.filter(id=>typeof id==='string'))]:[];
const history=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).filter(([id,time])=>id&&Number.isFinite(time)&&time>=0)):{};
// Fase L7: followed MLB team ids. Older envelopes without `teams` load as [].
export const TEAM_LIMIT=10;
const teams=value=>Array.isArray(value)?[...new Set(value.filter(Number.isInteger))].slice(0,TEAM_LIMIT):[];
// D4: intro marks learned per `seriesId:season`; older envelopes load as {}. Capped so a long life cannot grow the backup without bound.
export const INTRO_LIMIT=200;
const finite=value=>Number.isFinite(value)&&value>=0;
const intros=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).filter(([key,mark])=>key&&finite(mark?.start)&&finite(mark?.end)&&mark.end>mark.start).slice(-INTRO_LIMIT).map(([key,mark])=>[key,{start:mark.start,end:mark.end,samples:(Array.isArray(mark.samples)?mark.samples:[]).filter(sample=>finite(sample?.start)&&finite(sample?.end)).slice(-3).map(({start,end})=>({start,end}))}])):{};
const fields={favorites,history,teams,intros};
const library=value=>({favorites:favorites(value?.favorites),history:history(value?.history),teams:teams(value?.teams),intros:intros(value?.intros)});
const envelope=value=>value?.version===1&&Number.isFinite(value.updatedAt)&&value.data?value:null;

// Preserve the old keys for migration and for immediate recovery on shutdown.
// The versioned copy carries a timestamp, so a late backup cannot undo a click.
export function createProfileLibrary(profileId,{local=globalThis.localStorage,backup=deviceStorage,now=Date.now,delay=250}={}){
 const favoriteKey='rf-favorites-'+profileId,historyKey='rf-history-'+profileId,key='rf-library-v1:'+profileId;
 const read=name=>{try{return JSON.parse(local.getItem(name));}catch{return null;}};
 const raw=read(key),futureLocal=Number(raw?.version)>1,saved=envelope(futureLocal?read(key+':recovery-v1'):raw),legacyFavorites=read(favoriteKey),legacyHistory=read(historyKey);
 let state=library(saved?.data||{favorites:legacyFavorites,history:legacyHistory}),updatedAt=saved?.updatedAt||0,revision=0,pending,probe,timer,writing,dirty=false,futureBackup=false;
 const listeners=new Set();
 const snapshot=()=>({version:1,updatedAt,data:state});
 const writeLocal=()=>{let success=false;for(const [name,value] of [[favoriteKey,state.favorites],[historyKey,state.history],[futureLocal?key+':recovery-v1':key,snapshot()]])try{local.setItem(name,JSON.stringify(value));success=true;}catch{}return success;};
 const readBackup=()=>probe??=(async()=>{
  try{const value=await backup(key);futureBackup=Number(value?.version)>1;return envelope(value)||envelope(await backup(key+':recovery-v1'));}catch{futureBackup=true;return null;}
 })();
 const notify=()=>{for(const listener of listeners)listener();};
 const flush=()=>{
  clearTimeout(timer);timer=null;
  if(writing){dirty=true;return writing.then(()=>dirty?flush():undefined);}
  dirty=false;const value=snapshot();
  writing=Promise.resolve().then(readBackup).then(()=>backup(futureBackup?key+':recovery-v1':key,value)).finally(()=>{writing=null;});
  const work=writing;
  return work.finally(()=>{if(dirty&&!timer)timer=setTimeout(()=>flush().catch(()=>{}),delay);});
 };
 const schedule=()=>{dirty=true;if(!timer)timer=setTimeout(()=>flush().catch(()=>{}),delay);};
 const update=(field,next)=>{
  const value=typeof next==='function'?next(state[field]):next;
  state={...state,[field]:fields[field](value)};
  revision++;updatedAt=Math.max(now(),updatedAt+1);writeLocal();schedule();notify();
 };
 return {
  get:()=>state,
  subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
  setFavorites:next=>update('favorites',next),setHistory:next=>update('history',next),setTeams:next=>update('teams',next),setIntros:next=>update('intros',next),flush,
  load:()=>pending??=(async()=>{
   const started=revision,stored=await readBackup();
   if(started!==revision)return state;
   const legacyPresent=legacyFavorites!==null||legacyHistory!==null;
   if(stored&&stored.updatedAt>updatedAt&&(!legacyPresent||saved)){
    state=library(stored.data);updatedAt=stored.updatedAt;writeLocal();notify();
   }else if(!updatedAt){updatedAt=now();writeLocal();schedule();}
   return state;
  })(),
 };
}
