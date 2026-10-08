import {useCallback,useSyncExternalStore} from 'react';
// R6.1: card metadata by id. Each Card subscribes to its own id, so a preview reply rerenders that card, not the rails or App.
// Layers keep today's precedence: base = TMDB selection, else cached score; a preview reply (details) replaces the base when its
// tmdbId differs, else merges over it; the channel guide is added as `guide`. Notifications are grouped per task (setTimeout 0).
const details=new Map(),layers={selection:{},score:{},guide:{}},entries=new Map(),listeners=new Map(),dirty=new Set();
const EMPTY={metadata:undefined,resolved:false,priority:false},DETAILS_LIMIT=80;let timer=null,tracking=false,priority=null;
// App owns preview replies: once it loads, a movie/series without a reply is pending. Without App (fixtures) nothing is pending.
export function trackMetadataPending(){tracking=true;}
export const metadataTracked=()=>tracking;
const own=(map,id)=>Object.hasOwn(map,id)?map[id]:undefined;
function compute(id){
 const base=own(layers.selection,id)||own(layers.score,id),data=details.get(id),guide=own(layers.guide,id);
 let value=data?(!base?data:data.tmdbId&&data.tmdbId!==base.tmdbId?{...data}:{...base,...data}):base;
 if(guide)value={...value,guide};
 return {metadata:value,resolved:details.has(id),priority:priority===id};
}
function flush(){timer=null;const ids=[...dirty];dirty.clear();for(const id of ids)for(const listener of listeners.get(id)||[])listener();}
function touch(id){entries.delete(id);if(!listeners.has(id))return;dirty.add(id);if(timer===null)timer=setTimeout(flush,0);}
export function getMetadataEntry(id){
 if(id==null)return EMPTY;
 let entry=entries.get(id);if(!entry){entry=compute(id);entries.set(id,entry);}
 return entry;
}
export const getMetadata=id=>getMetadataEntry(id).metadata;
export const getPreviewDetails=id=>details.get(id);
export const isMetadataResolved=id=>details.has(id);
export const metadataStats=()=>({details:details.size,subscribed:listeners.size});
// A preview reply ({} = known to have none). The oldest replies of unmounted ids are dropped beyond the limit.
export function publishMetadata(id,data){
 if(details.get(id)===data)return;
 details.delete(id);details.set(id,data);touch(id);
 for(const old of details.keys()){if(details.size<=DETAILS_LIMIT)break;if(!listeners.has(old)){details.delete(old);entries.delete(old);}}
}
// selection | score | guide: a whole map at once; only ids whose value changed are notified.
export function setMetadataLayer(name,map={}){
 const previous=layers[name];if(previous===map)return;layers[name]=map;
 for(const id of Object.keys(previous))if(previous[id]!==own(map,id))touch(id);
 for(const id of Object.keys(map))if(!Object.hasOwn(previous,id))touch(id);
}
// New connection, profile or metadata revision: preview replies start over (layers are replaced by their owners).
export function resetMetadata({layers:all=false}={}){
 for(const id of details.keys())touch(id);details.clear();setMetadataPriority(null);
 if(all)for(const name of Object.keys(layers))setMetadataLayer(name,{});
}
// G4: the one title whose reply the banner waits for (was App state: one App render when it cleared).
export function setMetadataPriority(id){id??=null;if(priority===id)return;const previous=priority;priority=id;if(previous!==null)touch(previous);if(id!==null)touch(id);}
export const getMetadataPriority=()=>priority;
export function flushMetadata(){clearTimeout(timer);flush();}
export function subscribeMetadata(id,listener){
 let subscribers=listeners.get(id);if(!subscribers){subscribers=new Set();listeners.set(id,subscribers);}subscribers.add(listener);
 return()=>{subscribers.delete(listener);if(!subscribers.size){listeners.delete(id);entries.delete(id);}};
}
export function useMetadataEntry(id){
 const subscribe=useCallback(listener=>id==null?()=>{}:subscribeMetadata(id,listener),[id]);
 return useSyncExternalStore(subscribe,()=>getMetadataEntry(id),()=>EMPTY);
}
export const useCardMetadata=id=>useMetadataEntry(id).metadata;
