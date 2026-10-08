import {groupShifted} from './cardExpansionSpace.js';
const controllers=new WeakMap();
export function registerVirtualNavigation(element,controller){controllers.set(element,controller);return()=>controllers.delete(element);}
export const virtualController=element=>controllers.get(element);
export const virtualCardIndex=element=>Number(element?.closest('[data-virtual-index]')?.dataset.virtualIndex??-1);
export function restoreVirtualFocus(group,index){return controllers.get(group)?.focus(index);}
// Ola 4 far rows (VirtualCarousel.jsx): rows more than one away from `row` get data-row-far (visibility:hidden in TV);
// hide=false only reveals. Chromium 130 cannot focus a node inside a hidden row, so every programmatic focus of a card
// goes through revealRowFor(element) first (returns the element: `revealRowFor(card)?.focus()`).
export const markFarRows=(row,hide=true)=>{const rows=[...document.querySelectorAll('.tv-mode .catalog-row')],at=row?rows.indexOf(row):-1;
 rows.forEach((node,index)=>{const far=at>=0&&Math.abs(index-at)>1;if(far!==node.hasAttribute('data-row-far')&&(hide||!far))node.toggleAttribute('data-row-far',far);});};
export const revealRowFor=element=>{const row=element?.closest?.('.catalog-row[data-row-far]');if(row)markFarRows(row);return element;};
// Spatial fallback is reserved for dialogs and loose controls. Read each box
// once, then choose the closest candidate without sorting the complete scope.
export function directionalTarget(currentRect,candidates,key){
 const horizontal=key==='ArrowLeft'||key==='ArrowRight',sign=key==='ArrowRight'||key==='ArrowDown'?1:-1;
 const x=currentRect.x+currentRect.width/2,y=currentRect.y+currentRect.height/2;
 let target=null,best=Infinity;
 for(const {element,rect}of candidates){
  const a=rect.x+rect.width/2-x,b=rect.y+rect.height/2-y,along=horizontal?a:b,across=horizontal?b:a;
  if(along*sign<=10)continue;
  const score=Math.abs(along)+Math.abs(across)*3;
  if(score<best){best=score;target=element;}
 }
 return target;
}
// Ola 3-F row halo. Timing read once per measure (no reads on the key path): the card's own lift duration and scale.
export function haloMotion(style){
 const reduced=Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
 return {duration:reduced?0:parseFloat(style.getPropertyValue('--tv-base'))||110,scale:parseFloat(style.getPropertyValue('--tv-focus-scale'))||1.06};
}
// The halo jumps to the reached card and lifts with it: one composited WAAPI animation, the previous one cancelled.
const lifts=new WeakMap();
export function liftHalo(node,frames,duration){lifts.get(node)?.cancel();if(node.animate)lifts.set(node,node.animate(frames,{duration,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'}));}
// A deferred window commit must not hand a cell carrying the open panel's neighbour shift (WAAPI on the cell, see
// cardExpansionSpace.js) to another item: while any cell is shifted, entering items get fresh nodes instead.
export const cellsShifted=group=>Boolean(group&&groupShifted(group));
