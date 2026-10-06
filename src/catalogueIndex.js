import {catalogueCategories} from './catalogueCategories.js';
import {catalogueWorkerClient} from './catalogueWorkerClient.js';
import {cooperativeForEach,cooperativeMap} from './cooperativeWork.js';

const prepared=new WeakMap();let sequence=0;
const abortError=()=>new DOMException('Búsqueda reemplazada','AbortError');
const check=signal=>{if(signal?.aborted)throw abortError();};
const remember=(store,key,result)=>{if(store.size>=8)store.delete(store.keys().next().value);store.set(key,result);return result;};

// Category membership arrives from the same worker as the catalogue. Opening a
// section does not repeat a full scan of thousands of titles on the UI thread.
export function primeCatalogueGroups(data){
 for(const name of ['movies','shows','channels']){
  const items=name==='channels'?(data.preparedChannels||data.channels):data[name],group=data.preparedGroups?.[name];
  if(Array.isArray(items)&&group)prepared.set(items,group);
 }
}

export function createCatalogueIndex(all,{workerClient}={}){
 const byId=new Map(),texts=new WeakMap(),cache=new WeakMap();for(const item of all)byId.set(item.id,item);
 const group=items=>{let value=cache.get(items);if(!value){const primed=prepared.get(items);value={categories:primed?.categories,positions:primed?.categoryPositions,results:new Map(),key:'catalogue-'+(++sequence),registeredSession:null,registration:null};cache.set(items,value);}return value;};
 const categories=items=>{const value=group(items);if(!value.categories){const names=new Set();for(const item of items)for(const name of catalogueCategories(item))if(typeof name==='string')names.add(name);value.categories=[...names].sort((a,b)=>a.localeCompare(b,'es'));}return value.categories;};
 const matches=(item,needle,category)=>{if(category!=='Todas'&&!(catalogueCategories(item)).includes(category))return false;if(!needle)return true;let text=texts.get(item);if(text===undefined){text=`${item.title||''} ${item.genre||''} ${item.source||''}`.toLocaleLowerCase('es');texts.set(item,text);}return text.includes(needle);};
 const client=()=>workerClient||(typeof Worker!=='undefined'?catalogueWorkerClient():null);
 async function register(items,value,remote,signal){
  if(value.registeredSession===remote.session&&['worker','fallback'].includes(remote.mode))return;
  // Lean records are shared by concurrent queries and copied once. Cancelling
  // one query must not poison the registration needed by its replacement.
  if(!value.registration){
   value.registration=(async()=>{
    const records=await cooperativeMap(items,item=>({id:item.id,title:item.title,genre:item.genre,genres:catalogueCategories(item),source:item.source}),{batchSize:128,budget:2});
    await remote.request('indexSearch',[value.key,records]);value.registeredSession=remote.session;
   })().finally(()=>{value.registration=null;});
  }
  await value.registration;check(signal);
 }
 return {byId,categories,filter(items,query='',category='Todas'){
  if(!query&&category==='Todas')return items;
  const needle=query.toLocaleLowerCase('es'),key=JSON.stringify([needle,category]),value=group(items);if(value.results.has(key))return value.results.get(key);
  const positions=!needle&&value.positions&&Object.prototype.hasOwnProperty.call(value.positions,category)?value.positions[category]:null;
  return remember(value.results,key,positions?positions.map(position=>items[position]):items.filter(item=>matches(item,needle,category)));
 },async search(items,query,{signal,batchSize=128,category='Todas'}={}){
  check(signal);const needle=query.toLocaleLowerCase('es'),key=JSON.stringify([needle,category]),value=group(items);
  if(value.results.has(key))return value.results.get(key);
  if(!needle)return this.filter(items,'',category);
  const remote=client();
  if(remote){
   try{
    await register(items,value,remote,signal);let ids;
    try{ids=await remote.request('search',[value.key,needle,category],{signal});}
    catch(error){if(error.code!=='SEARCH_INDEX_MISSING')throw error;value.registeredSession=null;await register(items,value,remote,signal);ids=await remote.request('search',[value.key,needle,category],{signal});}
    check(signal);const result=await cooperativeMap(ids,id=>byId.get(id),{batchSize:128,budget:2,cancelled:()=>Boolean(signal?.aborted)});check(signal);
    return remember(value.results,key,result.filter(Boolean));
   }catch(error){if(signal?.aborted||error.name==='AbortError')throw abortError();}
  }
  const result=[];
  try{await cooperativeForEach(items,item=>{if(matches(item,needle,category))result.push(item);},{batchSize:Math.min(batchSize,128),budget:2,cancelled:()=>Boolean(signal?.aborted)});}
  catch(error){check(signal);throw error;}check(signal);return remember(value.results,key,result);
 }};
}
