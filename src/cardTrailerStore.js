import {useSyncExternalStore} from 'react';
let owner=null;
const listeners=new Set(),emit=()=>{for(const listener of listeners)listener();};
export function claimCardTrailer(target,id,position){
 const claim={target,id,position};owner=claim;emit();
 return()=>{if(owner===claim){owner=null;emit();}};
}
const subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
export const useCardTrailer=()=>useSyncExternalStore(subscribe,()=>owner,()=>null);
