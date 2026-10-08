import {useSyncExternalStore} from 'react';
const active=new Set(),listeners=new Set();
export function publishPreviewPlayback(token,playing){
 const before=active.size>0;playing?active.add(token):active.delete(token);
 if(before!==(active.size>0))for(const listener of listeners)listener();
}
const subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
export const usePreviewPlayback=()=>useSyncExternalStore(subscribe,()=>active.size>0,()=>false);
