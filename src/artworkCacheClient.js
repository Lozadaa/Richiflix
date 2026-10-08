import {cacheableArtwork} from './artworkDiskCache.js';
import {registerPerformanceStats} from './focusPaintDiagnostics.js';

export function createArtworkCacheClient({createWorker=()=>import.meta.env?.DEV?new Worker(new URL('./artworkCacheWorker.js',import.meta.url),{type:'module',name:'richiflix-artwork'}):new Worker(new URL('./artworkCacheWorker.js',import.meta.url),{name:'richiflix-artwork'}),urls=globalThis.URL,timeout=10000,retain=96}={}){
 let worker,disabled=false,sequence=0;const requests=new Map(),handles=new Map();
 const fail=()=>{disabled=true;try{worker?.terminate();}catch{}worker=null;for(const job of requests.values()){clearTimeout(job.timer);job.resolve(null);}requests.clear();};
 function request(method,src){
  if(disabled||requests.size>=64)return Promise.resolve(null);
  if(!worker)try{worker=createWorker();worker.addEventListener('error',event=>{event.preventDefault?.();fail();});worker.addEventListener('messageerror',fail);worker.addEventListener('message',event=>{const job=requests.get(event.data?.id);if(!job)return;requests.delete(event.data.id);clearTimeout(job.timer);job.resolve(event.data.value);});}catch{fail();return Promise.resolve(null);}
  return new Promise(resolve=>{const id=++sequence,timer=setTimeout(()=>{requests.delete(id);resolve(null);},method==='get'?1200:timeout);requests.set(id,{resolve,timer});try{worker.postMessage({id,method,src});}catch{fail();}});
 }
 // R4.3: one blob URL per poster for the whole session. A URL that leaves the DOM
 // stays registered (Map order = LRU), so a card re-entering the window reuses the
 // same URL and Blink's memory cache returns the decoded image: no second decode.
 // Only eviction past `retain` URLs, forget() or dispose() revokes.
 const drop=entry=>{if(handles.get(entry.key)===entry)handles.delete(entry.key);if(entry.url)urls.revokeObjectURL(entry.url);entry.url=null;};
 const touch=entry=>{handles.delete(entry.key);handles.set(entry.key,entry);};
 function trim(){let extra=[...handles.values()].filter(entry=>entry.url).length-retain;for(const entry of [...handles.values()]){if(extra<=0)break;if(!entry.refs&&entry.url){drop(entry);extra--;}}}
 function release(entry){if(--entry.refs>0)return;if(!entry.url||handles.get(entry.key)!==entry){drop(entry);return;}trim();}
 return {
  acquire(value){
   const key=cacheableArtwork(value);if(!key||disabled)return {ready:Promise.resolve(null),release(){}};
   let entry=handles.get(key);
   if(!entry){entry={key,refs:0,url:null};handles.set(key,entry);entry.ready=request('get',key).then(blob=>{if(!(blob instanceof Blob)||!entry.refs||handles.get(key)!==entry)return null;entry.url=urls.createObjectURL(blob);trim();return entry.url;});}
   else touch(entry);
   entry.refs++;let released=false;return {ready:entry.ready,release(){if(released)return;released=true;release(entry);}};
  },
  remember:value=>cacheableArtwork(value)?request('remember',value):Promise.resolve(false),
  // Synchronous: a remount renders the retained URL on its first frame.
  peek:value=>{const entry=handles.get(cacheableArtwork(value));return entry?.url||null;},
  forget:value=>{const key=cacheableArtwork(value);if(!key)return Promise.resolve(false);const entry=handles.get(key);if(entry){if(entry.refs)handles.delete(key);else drop(entry);}return request('forget',key);},
  diagnostics:()=>{let activeImages=0,blobUrls=0;for(const entry of handles.values()){if(entry.refs)activeImages++;if(entry.url)blobUrls++;}return {activeImages,blobUrls,pending:requests.size,disabled};},
  warm:()=>request('warm'),diskStats:()=>request('stats'),idle:()=>request('idle'),
  dispose(){fail();for(const entry of handles.values())if(entry.url)urls.revokeObjectURL(entry.url);handles.clear();},
 };
}
let shared;
// R4.6: decodedImagePixels = what the screen keeps decoded (budget ≤ 45 MB = 11.8 Mpx on the TV).
export function artworkCacheClient(){if(!shared){shared=createArtworkCacheClient();registerPerformanceStats('artworkCache',()=>({...shared.diagnostics(),decodedImagePixels:[...document.images].reduce((sum,img)=>sum+(img.complete?img.naturalWidth*img.naturalHeight:0),0)}));}return shared;}
