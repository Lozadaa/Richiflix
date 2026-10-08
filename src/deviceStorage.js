// One database connection per widget, rather than opening it for every request.
let database;
function open(){
 if(database)return database;
 const work=new Promise((resolve,reject)=>{
  let settled=false,request;
  const fail=()=>{if(settled)return;settled=true;clearTimeout(timer);reject(Error('No se pudo abrir el almacenamiento del TV.'));};
  const timer=setTimeout(fail,4000);
  try{request=indexedDB.open('richiflix-xtream',1);}catch{fail();return;}
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('source'))request.result.createObjectStore('source');};
  request.onerror=fail;request.onblocked=fail;
  request.onsuccess=()=>{const db=request.result;if(settled){db.close();return;}settled=true;clearTimeout(timer);db.onversionchange=()=>{db.close();if(database===work)database=null;};db.onclose=()=>{if(database===work)database=null;};resolve(db);};
 });database=work;work.catch(()=>{if(database===work)database=null;});return work;
}
export async function deviceStorage(key,value){
 const db=await open();return new Promise((resolve,reject)=>{
  let tx,request,settled=false;
  const fail=()=>{if(settled)return;settled=true;clearTimeout(timer);reject(Error('No se pudo guardar en el dispositivo.'));};
  const timer=setTimeout(()=>{fail();try{tx?.abort();}catch{}},4000);
  try{tx=db.transaction('source',value===undefined?'readonly':'readwrite');const store=tx.objectStore('source');request=value===undefined?store.get(key):store.put(value,key);}catch(error){if(error.name==='InvalidStateError'){db.close();database=null;}fail();return;}
  tx.oncomplete=()=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value===undefined?request.result:value);};tx.onerror=tx.onabort=fail;
 });
}
