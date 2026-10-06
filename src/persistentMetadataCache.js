export function createPersistentMetadataCache({read,write,capacity=128,ttl=7*86400000,now=Date.now,delay=400}){
 let loaded,timer,writing,dirty=false,revision=0;const entries=new Map();
 const fresh=value=>value&&Number.isFinite(value.updatedAt)&&value.updatedAt<=now()+60000&&now()-value.updatedAt<ttl;
 const init=()=>loaded??=Promise.resolve().then(read).then(saved=>{
  if(Array.isArray(saved))for(const entry of saved.slice(-capacity)){
   if(!Array.isArray(entry)||typeof entry[0]!=='string'||!fresh(entry[1]))continue;
   entries.set(entry[0],entry[1]);
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
  async get(key){await init();const cached=entries.get(key);if(!fresh(cached)){if(entries.delete(key)){dirty=true;revision++;}return null;}entries.delete(key);entries.set(key,cached);return cached.data;},
  async getMany(keys){await init();const result={};for(const key of keys){const cached=entries.get(key);if(fresh(cached))result[key]=cached.data;}return result;},
  async put(key,data){await init();entries.delete(key);entries.set(key,{data,updatedAt:now()});while(entries.size>capacity)entries.delete(entries.keys().next().value);dirty=true;revision++;if(!timer&&!writing)timer=setTimeout(()=>flush().catch(()=>{}),delay);},
  flush,
 };
}
