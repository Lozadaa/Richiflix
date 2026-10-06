export const artworkCacheLimits={maxBytes:48*1024*1024,maxEntries:200,maxImageBytes:4*1024*1024,ttl:14*86400000};

// TMDB image paths are immutable and publicly cacheable. Provider logos keep
// the browser's normal cache: a CORS retry must never delay a private IPTV image.
export function cacheableArtwork(value){
 try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='image.tmdb.org'&&!url.username&&!url.password&&!url.search&&!url.hash&&/^\/t\/p\/(?:w\d+|original)\/[\w.-]+\.(?:jpg|png|webp)$/i.test(url.pathname)?url.href:null;}catch{return null;}
}

export function createArtworkDiskCache({store,fetcher=fetch,estimate=()=>globalThis.navigator?.storage?.estimate?.(),now=Date.now,limits=artworkCacheLimits,concurrency=2,queueLimit=12}={}){
 const entries=new Map(),pending=new Map(),queue=[];let loaded,bytes=0,budget=limits.maxBytes,running=0,disabled=false,pausedUntil=0,writes=Promise.resolve(),hits=0,misses=0;
 const fresh=entry=>entry&&Number.isFinite(entry.updatedAt)&&entry.updatedAt<=now()+60000&&now()-entry.updatedAt<limits.ttl;
 const serial=work=>{const result=writes.catch(()=>{}).then(work);writes=result;return result;};
 const drop=async keys=>{if(!keys.length)return;await store.remove(keys);for(const key of keys){bytes-=entries.get(key)?.size||0;entries.delete(key);}};
 const oldest=()=>[...entries.values()].sort((a,b)=>a.lastUsed-b.lastUsed||a.updatedAt-b.updatedAt);
 async function trim(incoming=0){
  const remove=[];let size=bytes,count=entries.size;
  for(const entry of oldest()){if(fresh(entry))continue;remove.push(entry.key);size-=entry.size;count--;}
  const expired=new Set(remove);
  for(const entry of oldest()){if(expired.has(entry.key))continue;if(size+incoming<=budget&&count+(incoming?1:0)<=limits.maxEntries)break;remove.push(entry.key);size-=entry.size;count--;}
  await drop(remove);
 }
 const init=()=>loaded??=(async()=>{
  try{
   const saved=await store.list(),invalid=[];
   for(const entry of saved||[]){if(!cacheableArtwork(entry?.key)||!fresh(entry)||!Number.isFinite(entry.size)||entry.size<=0||entry.size>limits.maxImageBytes){if(entry?.key)invalid.push(entry.key);continue;}entries.set(entry.key,{...entry,lastUsed:Number.isFinite(entry.lastUsed)?entry.lastUsed:entry.updatedAt});bytes+=entry.size;}
   try{const storage=await estimate();if(Number.isFinite(storage?.quota)&&Number.isFinite(storage?.usage))budget=Math.max(0,Math.floor(Math.min(budget,storage.quota*.1,(storage.quota-storage.usage+bytes)*.25)));}catch{}
   await drop(invalid);await trim();
  }catch{disabled=true;}
 })();
 async function download(key){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  try{
   const response=await fetcher(key,{signal:controller.signal,credentials:'omit',cache:'force-cache',mode:'cors',referrerPolicy:'no-referrer'});
   const type=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
   if(!response.ok||!['image/jpeg','image/png','image/webp'].includes(type)||Number(response.headers.get('content-length'))>limits.maxImageBytes)return null;
   // Stop oversized streams before buffering the complete remote response.
   let blob;
   if(response.body?.getReader){const reader=response.body.getReader(),chunks=[];let size=0;for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>limits.maxImageBytes){await reader.cancel();return null;}chunks.push(chunk.value);}blob=new Blob(chunks,{type});}
   else blob=await response.blob();
   return blob.size>0&&blob.size<=limits.maxImageBytes?blob:null;
  }catch{return null;}finally{clearTimeout(timeout);}
 }
 async function save(key,blob){
  return serial(async()=>{
   if(disabled||now()<pausedUntil||blob.size>budget)return false;
   if(entries.has(key))await drop([key]);await trim(blob.size);
   const entry={key,size:blob.size,updatedAt:now(),lastUsed:now()};
   try{await store.put(entry,blob);}catch(error){
    if(error.name!=='QuotaExceededError'){pausedUntil=now()+15*60000;return false;}
    // One bounded retry after dropping the least recently used quarter.
    try{await drop(oldest().slice(0,Math.max(1,Math.ceil(entries.size/4))).map(value=>value.key));await store.put(entry,blob);}catch{pausedUntil=now()+15*60000;return false;}
   }
   entries.set(key,entry);bytes+=entry.size;return true;
  });
 }
 function pump(){while(running<concurrency&&queue.length){const job=queue.shift();running++;(async()=>{try{await init();if(disabled||now()<pausedUntil||fresh(entries.get(job.key)))return false;const blob=await download(job.key);return blob?await save(job.key,blob):false;}catch{return false;}})().then(value=>{pending.delete(job.key);running--;job.resolve(value);pump();});}}
 return {
  warm:async()=>{await init();return !disabled;},
  async get(value){
   const key=cacheableArtwork(value);if(!key)return null;await init();if(disabled)return null;
   const entry=entries.get(key);if(!fresh(entry)){misses++;if(entry)serial(()=>entries.get(key)===entry?drop([key]):undefined).catch(()=>{});return null;}
   try{const blob=await store.get(key);if(!(blob instanceof Blob)||blob.size!==entry.size){serial(()=>entries.get(key)===entry?drop([key]):undefined).catch(()=>{});return null;}hits++;const previous=entry.lastUsed;entry.lastUsed=now();if(entry.lastUsed-previous>60000)serial(()=>entries.get(key)===entry?store.touch({...entry}):undefined).catch(()=>{});return blob;}catch{return null;}
  },
  async forget(value){const key=cacheableArtwork(value);if(!key)return;await init();if(!disabled)await serial(()=>drop([key]));},
  remember(value){
   const key=cacheableArtwork(value);if(!key||disabled||now()<pausedUntil||fresh(entries.get(key)))return Promise.resolve(false);if(pending.has(key))return pending.get(key);
   const work=new Promise(resolve=>{queue.push({key,resolve});if(queue.length>queueLimit){const skipped=queue.shift();pending.delete(skipped.key);skipped.resolve(false);}});pending.set(key,work);pump();return work;
  },
  stats:()=>({entries:entries.size,bytes,budget,running,queued:queue.length,hits,misses,disabled,writePaused:now()<pausedUntil}),
  idle:async()=>{await Promise.all([...pending.values()]);await writes.catch(()=>{});},
 };
}
