import {useCallback,useSyncExternalStore} from 'react';
let selected=null;
const listeners=new Map();
const notify=id=>{for(const listener of listeners.get(id)||[])listener();};
// R1.4: a key notifies two cards, the one left and the one reached. The quick drop of the card left is CSS
// (no transition on the way out in TV), so there is no "leaving" state, timer or third render.
// Ola 4 (TV): the card left drops at once in the DOM (lift class and expanded state off, its panel hidden) and its
// React render, which unmounts the open panel (up to 40 ms on the TV), runs when the main thread is idle (≤ 120 ms),
// out of the key's frame. Coming back before that restores the classes React still believes are there.
const drops=new Set();let dropTask=0;
const ownedPanels=id=>[...document.querySelectorAll('.card-expansion')].filter(panel=>panel.dataset.cardOwner===id);
const flushDrops=()=>{dropTask=0;const ids=[...drops];drops.clear();for(const id of ids)if(selected!==id)notify(id);};
function dropLater(id){
 const card=globalThis.document?.querySelector?.(`.tv-mode .card[data-card-id="${globalThis.CSS?.escape?CSS.escape(id):id}"]`);if(!card)return false;
 card.classList.remove('is-previewed','is-expanded');for(const panel of ownedPanels(id))panel.style.visibility='hidden';
 drops.add(id);if(!dropTask)dropTask=globalThis.requestIdleCallback?requestIdleCallback(flushDrops,{timeout:120}):setTimeout(flushDrops,60);
 return true;
}
function undrop(id){
 if(!drops.delete(id))return;
 document.querySelector(`.card[data-card-id="${globalThis.CSS?.escape?CSS.escape(id):id}"]`)?.classList.add('is-previewed');for(const panel of ownedPanels(id))panel.style.visibility='';
}
export function setSelectedCard(instanceId){
 if(selected===instanceId)return;const previous=selected;selected=instanceId??null;
 if(previous!==null&&!dropLater(previous))notify(previous);if(selected!==null){undrop(selected);notify(selected);}
}
export const getSelectedCard=()=>selected;
function useCardStore(instanceId,read){
 const subscribe=useCallback(listener=>{
  let subscribers=listeners.get(instanceId);if(!subscribers){subscribers=new Set();listeners.set(instanceId,subscribers);}subscribers.add(listener);
  return()=>{subscribers.delete(listener);if(!subscribers.size)listeners.delete(instanceId);};
 },[instanceId]);
 return useSyncExternalStore(subscribe,()=>read(instanceId),()=>false);
}
export const useCardSelected=instanceId=>useCardStore(instanceId,id=>selected===id);
