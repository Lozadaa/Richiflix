import {catalogueWorkerMethods} from './catalogueWorkerProtocol.js';
import {registerPerformanceStats} from './focusPaintDiagnostics.js';

const abortError=()=>new DOMException('El trabajo anterior fue cancelado.','AbortError');
const unavailableError=()=>{const error=Error('No se pudo confirmar la tarea en segundo plano. Inténtalo de nuevo.');error.code='WORKER_UNAVAILABLE';return error;};
const mutations=new Set(['save','remove','restore','metadataSave']);
const defaultWorker=()=>import.meta.env?.DEV?new Worker(new URL('./catalogueWorker.js',import.meta.url),{type:'module',name:'richiflix-catalogue'}):new Worker(new URL('./catalogueWorker.js',import.meta.url),{name:'richiflix-catalogue'});
const defaultFallback=()=>import('./catalogueWorker.js').then(module=>module.createCatalogueWorkerService());

export function createCatalogueWorkerClient({createWorker=defaultWorker,fallbackFactory=defaultFallback,readyTimeout=3000,requestTimeout=60000,maxPending=24,schedule=setTimeout,cancel=clearTimeout}={}){
 let worker,mode='idle',session=0,ready,resolveReady,readyTimer,fallback,sequence=0,disposed=false;const pending=new Map();
 const remove=entry=>{pending.delete(entry.id);cancel(entry.timer);entry.signal?.removeEventListener('abort',entry.abort);};
 const settle=(entry,error,value)=>{if(!pending.has(entry.id))return;remove(entry);if(error)entry.reject(error);else entry.resolve(value);};
 const detach=()=>{if(!worker)return;worker.removeEventListener('message',onMessage);worker.removeEventListener('error',onError);worker.removeEventListener('messageerror',onError);try{worker.terminate();}catch{}worker=null;};
 const useFallback=()=>{
  if(disposed||mode==='fallback')return;const previous=mode;mode='fallback';session++;cancel(readyTimer);detach();resolveReady?.();
  if(previous==='worker')for(const entry of [...pending.values()])if(entry.sent){entry.sent=false;if(mutations.has(entry.method))settle(entry,unavailableError());else void dispatchFallback(entry);}
 };
 const start=()=>{
  if(ready)return ready;ready=new Promise(resolve=>{resolveReady=resolve;});mode='starting';session++;
  try{worker=createWorker();worker.addEventListener('message',onMessage);worker.addEventListener('error',onError);worker.addEventListener('messageerror',onError);readyTimer=schedule(useFallback,readyTimeout);}catch{useFallback();}
  return ready;
 };
 const onError=event=>{event?.preventDefault?.();useFallback();};
 const onMessage=event=>{
  const message=event.data;if(!message||typeof message!=='object')return;
  if(message.type==='ready'&&mode==='starting'){cancel(readyTimer);if(message.backendAvailable===false){useFallback();return;}mode='worker';resolveReady?.();return;}
  if(message.type!=='response'||mode!=='worker')return;const entry=pending.get(message.id);if(!entry)return;
  if(message.error){const error=message.error.name==='AbortError'?abortError():Error(message.error.message||'No se pudo completar el catálogo.');error.name=message.error.name||'Error';if(message.error.code)error.code=message.error.code;settle(entry,error);}else settle(entry,null,message.value);
 };
 async function dispatchFallback(entry){
  try{fallback??=Promise.resolve().then(fallbackFactory);const service=await fallback;if(!pending.has(entry.id)||disposed)return;const value=await service.request(entry.method,entry.args,{signal:entry.controller.signal});settle(entry,null,value);}catch(error){settle(entry,error);}
 }
 async function dispatch(entry){
  await start();if(!pending.has(entry.id)||disposed)return;
  if(mode==='fallback'){await dispatchFallback(entry);return;}
  entry.sent=true;try{worker.postMessage({type:'request',id:entry.id,method:entry.method,args:entry.args});}catch{useFallback();}
 }
 return {
  request(method,args=[],{signal}={}){
   if(disposed||signal?.aborted)return Promise.reject(abortError());
   if(!catalogueWorkerMethods.has(method)||!Array.isArray(args))return Promise.reject(Error('Operación de catálogo no válida.'));
   if(pending.size>=maxPending){const error=Error('Hay demasiadas tareas de catálogo pendientes.');error.code='WORKER_BUSY';return Promise.reject(error);}
   return new Promise((resolve,reject)=>{
    const entry={id:++sequence,method,args,signal,resolve,reject,controller:new AbortController(),sent:false};
    entry.abort=()=>{if(entry.sent)try{worker?.postMessage({type:'cancel',id:entry.id});}catch{}entry.controller.abort();settle(entry,abortError());};
    pending.set(entry.id,entry);signal?.addEventListener('abort',entry.abort,{once:true});
    entry.timer=schedule(()=>{if(entry.sent)try{worker?.postMessage({type:'cancel',id:entry.id});}catch{}entry.controller.abort();const error=Error('La tarea de catálogo tardó demasiado.');error.code='WORKER_TIMEOUT';settle(entry,error);},requestTimeout);
    void dispatch(entry).catch(error=>settle(entry,error));
   });
  },
  get available(){return mode==='worker';},get mode(){return mode;},get session(){return session;},
  diagnostics:()=>({mode,session,pending:pending.size}),
  dispose(){if(disposed)return;disposed=true;mode='closed';session++;cancel(readyTimer);detach();resolveReady?.();for(const entry of [...pending.values()]){entry.controller.abort();settle(entry,abortError());}},
 };
}

let shared;
export function catalogueWorkerClient(){if(!shared){shared=createCatalogueWorkerClient();registerPerformanceStats('catalogueWorker',()=>shared.diagnostics());}return shared;}
export function flushCatalogueWorker(){if(shared&&shared.mode!=='closed')shared.request('flush').catch(()=>{});}
