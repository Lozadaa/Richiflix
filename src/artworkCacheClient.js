import {cacheableArtwork} from './artworkDiskCache.js';
import {registerPerformanceStats} from './focusPaintDiagnostics.js';

export function createArtworkCacheClient({createWorker=()=>import.meta.env?.DEV?new Worker(new URL('./artworkCacheWorker.js',import.meta.url),{type:'module',name:'richiflix-artwork'}):new Worker(new URL('./artworkCacheWorker.js',import.meta.url),{name:'richiflix-artwork'}),urls=globalThis.URL,timeout=10000}={}){
 let worker,disabled=false,sequence=0;const requests=new Map(),handles=new Map();
 const fail=()=>{disabled=true;try{worker?.terminate();}catch{}worker=null;for(const job of requests.values()){clearTimeout(job.timer);job.resolve(null);}requests.clear();};
 function request(method,src){
  if(disabled||requests.size>=64)return Promise.resolve(null);
  if(!worker)try{worker=createWorker();worker.addEventListener('error',event=>{event.preventDefault?.();fail();});worker.addEventListener('messageerror',fail);worker.addEventListener('message',event=>{const job=requests.get(event.data?.id);if(!job)return;requests.delete(event.data.id);clearTimeout(job.timer);job.resolve(event.data.value);});}catch{fail();return Promise.resolve(null);}
  return new Promise(resolve=>{const id=++sequence,timer=setTimeout(()=>{requests.delete(id);resolve(null);},method==='get'?1200:timeout);requests.set(id,{resolve,timer});try{worker.postMessage({id,method,src});}catch{fail();}});
 }
 function release(entry){if(--entry.refs>0)return;if(handles.get(entry.key)===entry)handles.delete(entry.key);if(entry.url)urls.revokeObjectURL(entry.url);entry.url=null;}
 return {
  acquire(value){
   const key=cacheableArtwork(value);if(!key||disabled)return {ready:Promise.resolve(null),release(){}};
   let entry=handles.get(key);
   if(!entry){entry={key,refs:0,url:null};handles.set(key,entry);entry.ready=request('get',key).then(blob=>{if(!(blob instanceof Blob)||!entry.refs)return null;entry.url=urls.createObjectURL(blob);return entry.url;});}
   entry.refs++;let released=false;return {ready:entry.ready,release(){if(released)return;released=true;release(entry);}};
  },
  remember:value=>cacheableArtwork(value)?request('remember',value):Promise.resolve(false),
  forget:value=>{const key=cacheableArtwork(value);if(!key)return Promise.resolve(false);handles.delete(key);return request('forget',key);},
  diagnostics:()=>({activeImages:handles.size,pending:requests.size,disabled}),
  warm:()=>request('warm'),diskStats:()=>request('stats'),idle:()=>request('idle'),
  dispose(){fail();for(const entry of handles.values())if(entry.url)urls.revokeObjectURL(entry.url);handles.clear();},
 };
}
let shared;
export function artworkCacheClient(){if(!shared){shared=createArtworkCacheClient();registerPerformanceStats('artworkCache',()=>shared.diagnostics());}return shared;}
