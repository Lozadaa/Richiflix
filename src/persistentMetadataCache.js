export const previewMetadataCacheOptions={capacity:2000,maxBytes:6*1024*1024,ttl:30*86400000,ttlForData:data=>data?.descriptionLanguage==='es'&&data.description?30*86400000:Object.keys(data||{}).length?7*86400000:5*60000};
export function createPersistentMetadataCache({read,write,capacity=128,ttl=7*86400000,ttlForData=()=>ttl,maxBytes=Infinity,now=Date.now,delay=400}){
 let loaded,timer,writing,dirty=false,revision=0,bytes=0;const entries=new Map(),sizes=new Map(),encoder=Number.isFinite(maxBytes)?new TextEncoder():null;
 const size=(key,value)=>encoder?encoder.encode(JSON.stringify([key,value])).byteLength+2:0;
 const remove=key=>{bytes-=sizes.get(key)||0;sizes.delete(key);return entries.delete(key);};
 const trim=()=>{while(entries.size>capacity||bytes>maxBytes)remove(entries.keys().next().value);};
 const fresh=value=>value&&Number.isFinite(value.updatedAt)&&value.updatedAt<=now()+60000&&now()-value.updatedAt<ttlForData(value.data);
 const init=()=>loaded??=Promise.resolve().then(read).then(saved=>{
  if(Array.isArray(saved))for(const entry of saved.slice(-capacity)){
   if(!Array.isArray(entry)||typeof entry[0]!=='string'||!fresh(entry[1]))continue;
   const length=size(entry[0],entry[1]);if(length>maxBytes)continue;remove(entry[0]);entries.set(entry[0],entry[1]);sizes.set(entry[0],length);bytes+=length;trim();
  }
 }).catch(()=>{});
 const flush=async()=>{
  clearTimeout(timer);timer=null;await init();
  if(writing){await writing;if(dirty)return flush();return;}
  if(!dirty)return;
  dirty=false;const values=[...entries],started=revision;
  writing=Promise.resolve().then(()=>write(values));
  try{await writing;}catch{dirty=true;}finally{writing=null;}
  if(dirty&&revision!==started&&!timer)timer=setTimeout(()=>flush().catch(()=>{}),delay);
 };
 return {
  async get(key){await init();const cached=entries.get(key);if(!fresh(cached)){if(remove(key)){dirty=true;revision++;}return null;}entries.delete(key);entries.set(key,cached);return cached.data;},
  async getMany(keys){await init();const result={};for(const key of keys){const cached=entries.get(key);if(fresh(cached))result[key]=cached.data;}return result;},
  async put(key,data){await init();const entry={data,updatedAt:now()},length=size(key,entry);if(length>maxBytes)return;remove(key);entries.set(key,entry);sizes.set(key,length);bytes+=length;trim();dirty=true;revision++;if(!timer&&!writing)timer=setTimeout(()=>flush().catch(()=>{}),delay);},
  stats:()=>({entries:entries.size,bytes,maxBytes}),
  flush,
 };
}
