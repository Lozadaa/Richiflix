import {useCallback,useSyncExternalStore} from 'react';
let selected=null;
const listeners=new Map();
export function setSelectedCard(instanceId){
 if(selected===instanceId)return;const previous=selected;selected=instanceId??null;
 for(const id of [previous,selected])for(const listener of listeners.get(id)||[])listener();
}
export const getSelectedCard=()=>selected;
export function useCardSelected(instanceId){
 const subscribe=useCallback(listener=>{
  let subscribers=listeners.get(instanceId);if(!subscribers){subscribers=new Set();listeners.set(instanceId,subscribers);}subscribers.add(listener);
  return()=>{subscribers.delete(listener);if(!subscribers.size)listeners.delete(instanceId);};
 },[instanceId]);
 return useSyncExternalStore(subscribe,()=>selected===instanceId,()=>false);
}
