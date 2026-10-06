export function createPreviewCache(load,{concurrency=2,capacity=80,queueLimit=6}={}){
 const entries=new Map(),queue=[],pending=new Set();let running=0,disposed=false;
 function trim(){for(const key of entries.keys()){if(entries.size<=capacity)break;if(!pending.has(key))entries.delete(key);}}
 function pump(){while(!disposed&&running<concurrency&&queue.length){const job=queue.shift();running++;Promise.resolve().then(()=>load(job.item)).then(job.resolve,error=>{entries.delete(job.key);job.reject(error);}).finally(()=>{pending.delete(job.key);running--;trim();pump();});}}
 return {
  get disposed(){return disposed;},
  get stats(){return {running,queued:queue.length,retained:entries.size};},
  get(item,priority=false){
   if(disposed)return Promise.reject(Error('Vista cerrada'));
   const key=`${item.sourceId||'eterboxtv'}:${item.mediaType}:${item.streamId}`,existing=entries.get(key);
   if(existing){entries.delete(key);entries.set(key,existing);if(priority){const index=queue.findIndex(job=>job.key===key);if(index>=0){queue[index].priority=true;if(index>0)queue.unshift(...queue.splice(index,1));}}return existing;}
   const promise=new Promise((resolve,reject)=>{const job={key,item,resolve,reject,priority};priority?queue.unshift(job):queue.push(job);});entries.set(key,promise);
   pending.add(key);while(queue.length>queueLimit){const ordinary=queue.findIndex(job=>!job.priority),dropped=queue.splice(ordinary<0?queue.length-1:ordinary,1)[0];pending.delete(dropped.key);entries.delete(dropped.key);dropped.reject(Error('Vista reemplazada'));}trim();
   pump();return promise;
  },
  dispose(){disposed=true;for(const job of queue.splice(0))job.reject(Error('Vista cerrada'));entries.clear();},
 };
}
