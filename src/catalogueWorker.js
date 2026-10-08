import {catalogueCategories} from './catalogueCategories.js';
import {createBrowserXtreamBackend} from './browserXtreamBackend.js';
import {prepareChannels} from './channelPreparation.js';
import {cooperativeMap,cooperativeForEach} from './cooperativeWork.js';
import {catalogueWorkerMethods} from './catalogueWorkerProtocol.js';
import {fuzzySearch,prepareFuzzyIndex} from './fuzzySearch.js';

export {catalogueWorkerMethods} from './catalogueWorkerProtocol.js';
const cancelledError=()=>new DOMException('El trabajo anterior fue cancelado.','AbortError');

// Also used as a cooperative fallback on devices which refuse worker files.
// Creating the search service alone never opens the source database.
export function createCatalogueWorkerService({backendFactory=createBrowserXtreamBackend,maxSearchGroups=8}={}){
 let backend;const groups=new Map();
 const touch=(key,value)=>{groups.delete(key);groups.set(key,value);while(groups.size>maxSearchGroups)groups.delete(groups.keys().next().value);};
 const check=signal=>{if(signal?.aborted)throw cancelledError();};
 return {async request(method,args=[],{signal}={}){
  if(!catalogueWorkerMethods.has(method))throw Error('Operación de catálogo no válida.');check(signal);
  const options={cancelled:()=>Boolean(signal?.aborted),budget:2,batchSize:128};
  try{
   if(method==='prepareChannels')return await prepareChannels(args[0],options);
   if(method==='indexSearch'){
    const [key,items]=args;if(typeof key!=='string'||!Array.isArray(items))throw Error('Índice de búsqueda no válido.');
    const records=await cooperativeMap(items,item=>({id:item.id,text:`${item.title||''} ${item.genre||''} ${item.source||''}`.toLocaleLowerCase('es'),genres:catalogueCategories(item),clean:item.clean||item.title||''}),options);
    check(signal);touch(key,{records,results:new Map()});setTimeout(()=>{if(groups.get(key)?.records===records)prepareFuzzyIndex(records);},0);return {count:records.length};
   }
   if(method==='dropSearch'){groups.delete(args[0]);return true;}
   if(method==='search'||method==='fuzzy'){
    const [key,query='',category='Todas']=args,group=groups.get(key);if(!group){const error=Error('El índice de búsqueda se debe preparar de nuevo.');error.code='SEARCH_INDEX_MISSING';throw error;}
    touch(key,group);
    if(method==='fuzzy'){const found=fuzzySearch(query,group.records,{accept:category==='Todas'?undefined:item=>item.genres.includes(category)});check(signal);return {ids:found.matches.map(match=>match.id),suggestions:found.suggestions};}const needle=String(query).toLocaleLowerCase('es'),cacheKey=JSON.stringify([needle,category]);if(group.results.has(cacheKey))return group.results.get(cacheKey);
    const ids=[];await cooperativeForEach(group.records,item=>{if((category==='Todas'||item.genres.includes(category))&&(!needle||item.text.includes(needle)))ids.push(item.id);},options);
    check(signal);if(group.results.size>=8)group.results.delete(group.results.keys().next().value);group.results.set(cacheKey,ids);return ids;
   }
   backend??=backendFactory();const value=await backend[method](...args);check(signal);return value;
  }catch(error){if(signal?.aborted)throw cancelledError();throw error;}
 }};
}

if(typeof WorkerGlobalScope!=='undefined'&&globalThis instanceof WorkerGlobalScope){
 const service=createCatalogueWorkerService(),jobs=new Map();
 globalThis.addEventListener('message',event=>{
  const message=event.data;if(!message||typeof message!=='object')return;
  if(message.type==='cancel'){jobs.get(message.id)?.abort();return;}
  if(message.type!=='request'||!Number.isSafeInteger(message.id)||!catalogueWorkerMethods.has(message.method)||!Array.isArray(message.args))return;
  if(jobs.size>=24){globalThis.postMessage({type:'response',id:message.id,error:{name:'Error',message:'Hay demasiadas tareas de catálogo pendientes.',code:'WORKER_BUSY'}});return;}
  const controller=new AbortController();jobs.set(message.id,controller);
  service.request(message.method,message.args,{signal:controller.signal}).then(value=>{if(!controller.signal.aborted)globalThis.postMessage({type:'response',id:message.id,value});},error=>{if(!controller.signal.aborted)globalThis.postMessage({type:'response',id:message.id,error:{name:error.name||'Error',message:error.message||'No se pudo completar el catálogo.',...(error.code?{code:error.code}:{})}});}).finally(()=>jobs.delete(message.id));
 });
 globalThis.postMessage({type:'ready',backendAvailable:Boolean(globalThis.indexedDB&&globalThis.crypto?.subtle)});
}
