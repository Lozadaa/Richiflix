// Blob payloads and the tiny eviction index are separate. Startup never reads
// or decodes all cached images. Profiles and sources use a different database.
export function createArtworkStorage({database=globalThis.indexedDB,timeout=1000}={}){
 let opening;
 const open=()=>opening??=new Promise((resolve,reject)=>{
  let request,settled=false;const fail=()=>{if(settled)return;settled=true;clearTimeout(timer);reject(Error('Artwork cache unavailable'));},timer=setTimeout(fail,timeout);
  try{request=database.open('richiflix-artwork',1);}catch{fail();return;}
  request.onupgradeneeded=()=>{for(const name of ['index','payload'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name);};
  request.onerror=request.onblocked=fail;
  request.onsuccess=()=>{const db=request.result;if(settled){db.close();return;}settled=true;clearTimeout(timer);db.onversionchange=()=>{db.close();opening=null;};resolve(db);};
 });
 async function transaction(names,mode,work){
  const db=await open();return new Promise((resolve,reject)=>{
   let tx,result,settled=false;const fail=error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error||tx?.error||Error('Artwork cache unavailable'));},timer=setTimeout(()=>{fail();try{tx?.abort();}catch{}},timeout);
   try{tx=db.transaction(names,mode);result=work(tx);}catch(error){fail(error);return;}
   tx.oncomplete=()=>{if(settled)return;settled=true;clearTimeout(timer);resolve(result?.result);};tx.onerror=event=>fail(event.target.error||tx.error);tx.onabort=()=>fail(tx.error);
  });
 }
 return {
  list:()=>transaction(['index'],'readonly',tx=>tx.objectStore('index').getAll()),
  get:key=>transaction(['payload'],'readonly',tx=>tx.objectStore('payload').get(key)),
  put:(entry,blob)=>transaction(['index','payload'],'readwrite',tx=>{tx.objectStore('index').put(entry,entry.key);tx.objectStore('payload').put(blob,entry.key);}),
  touch:entry=>transaction(['index'],'readwrite',tx=>tx.objectStore('index').put(entry,entry.key)),
  remove:keys=>transaction(['index','payload'],'readwrite',tx=>{for(const key of keys){tx.objectStore('index').delete(key);tx.objectStore('payload').delete(key);}}),
 };
}
