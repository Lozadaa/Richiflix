export function createProactivePreviews({cache,publish,schedule=setTimeout,cancel=clearTimeout,delay=180}){
 const scopes=new Map(),completed=new Set(),pending=new Set();let enabled=false,closed=false,timer;
 const key=item=>`${item.sourceId||'eterboxtv'}:${item.mediaType}:${item.streamId}`;
 const candidates=()=>[...scopes.values()].flat();
 const pump=()=>{timer=null;if(!enabled||closed)return;for(const item of candidates()){
  if(pending.size>=2)break;const id=key(item);if(completed.has(id)||pending.has(id))continue;
  pending.add(id);cache.get(item).then(data=>{if(!closed){completed.add(id);publish(item,data);}},error=>{if(!closed){completed.add(id);if(!['Vista reemplazada','Vista cerrada'].includes(error.message))publish(item,{});}}).finally(()=>{pending.delete(id);queue();});
 }};
 const queue=()=>{if(enabled&&!closed&&!timer)timer=schedule(pump,delay);};
 return {
  watch(scope,items){const filtered=items.filter(item=>item&&['movie','series'].includes(item.mediaType));scopes.set(scope,filtered);const current=new Set(candidates().map(key));for(const id of completed)if(!current.has(id))completed.delete(id);queue();return()=>{scopes.delete(scope);};},
  enable(value){enabled=value;cancel(timer);timer=null;queue();},
  dispose(){closed=true;cancel(timer);scopes.clear();completed.clear();},
  diagnostics:()=>({scopes:scopes.size,pending:pending.size,completed:completed.size,enabled}),
 };
}
