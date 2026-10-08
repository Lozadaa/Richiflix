// Reserve the expanded footprint once at rest; logical indices, base measurements and the DOM budget stay fixed.
// `scroll` is the rail scroll applied here, so callers shift the model box once instead of measuring again.
// R1.1: neighbours move by Web Animations, one per moved cell (transform) or covered cell (opacity), fill
// forwards (plan: neighbourMotions). No inline styles, classes, track properties or sibling selectors, so an
// opening or a closing invalidates no rail style and needs no layer lease (the animations composite alone).
// cleanup(true) cancels them (instant, no style flush: a following expansion never sees them half-way back);
// cleanup() reverses them (calm pointer exit) and cancels each when it lands.
// Fase F, TV: the panel is fixed (z-index 35), so the track never changes size; the rail scrolls once, before
// any animation. Rail: every cell after the anchor slides by the same dx, F2 (align 'end', panel opens left):
// every cell before it; cells the scroll mounts later take the shift at once (MutationObserver on the track).
// Grid: the anchor row's right-hand cells. Cells that cannot make room fade. Only cells visible before or
// after the move animate; the others jump (duration 0).
import {anchorBoxFromLayout,neighbourShifts,neighbourMotions,neighbourDurations,shiftFrames,NEIGHBOUR_EASE} from './cardExpansion.js';
const durations=tv=>neighbourDurations({tv,samsung:Boolean(globalThis.document?.documentElement?.classList.contains('samsung-tv')),reduced:Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)});
// Ola 4: groups whose cells carry a neighbour shift right now (cellsShifted read getAnimations({subtree}) on every
// rail render: ≈ 70 ms per 20 keys on the TV).
const shifts=new WeakMap(),shiftBy=(group,delta)=>shifts.set(group,(shifts.get(group)||0)+delta);
export const groupShifted=group=>(shifts.get(group)||0)>0;
const play=(cell,keyframes,duration)=>cell.animate(keyframes,{duration,easing:NEIGHBOUR_EASE,fill:'forwards'});
function settle(animations,instant){
 for(const animation of animations){if(instant){animation.cancel();continue;}animation.onfinish=()=>animation.cancel();animation.reverse();}
}
function makeRoom(group,selected,box,panel,align){
 const rail=group.dataset.virtualKind==='rail',track=selected.parentElement,rect=track.getBoundingClientRect(),bounds=group.getBoundingClientRect(),trackRect={left:rect.left+track.clientLeft,top:rect.top+track.clientTop},nodes=new Map(),anchorIndex=Number(selected.dataset.virtualIndex),offset=group.scrollLeft;
 const cells=[...track.children].filter(cell=>cell.dataset.virtualIndex!==undefined).map(cell=>{const index=Number(cell.dataset.virtualIndex);nodes.set(index,cell);return {index,...anchorBoxFromLayout({trackRect,left:parseFloat(cell.style.left)||0,top:parseFloat(cell.style.top)||0,width:parseFloat(cell.style.width)||box.width,height:box.height})};});
 const visibleRight=Math.min(window.innerWidth,bounds.right),end=rail&&align==='end',model=neighbourShifts({cells,anchorIndex,panel,kind:rail?'rail':'grid',columns:Number(group.dataset.virtualColumns)||1,viewportRight:visibleRight-(rail?16:0),viewportLeft:Math.max(0,bounds.left)+16,align});
 // ponytail: the rail track carries a fixed tail (expandedCard.css) so this scroll always fits.
 let scroll=0;if(Math.abs(model.scroll)>1){group.scrollTo({left:offset+model.scroll,behavior:'instant'});scroll=group.scrollLeft-offset;}
 const byIndex=new Map(cells.map(cell=>[cell.index,cell])),seen=(index,x)=>{const cell=byIndex.get(index);return cell.left<visibleRight&&cell.left+cell.width>bounds.left||cell.left+x-scroll<visibleRight&&cell.left+x-scroll+cell.width>bounds.left;};
 const dx=model.shifts[0]?.[1]||0,side=index=>end?index<anchorIndex:index>anchorIndex,{move,fade}=durations(true);
 const shifts=rail?(dx?cells.filter(cell=>side(cell.index)).map(cell=>[cell.index,dx]):[]):model.shifts;
 // Ola 4: cells seen neither before nor after the move are left alone (no fill-forwards animation, no layer); the next
 // key closes the panel before they can scroll into view, and cells mounted later still take the shift (observer below).
 const animations=neighbourMotions({shifts:shifts.filter(([index,x])=>seen(index,x)),faded:model.faded.filter(index=>seen(index,0)),move,fade}).map(({index,keyframes,duration})=>play(nodes.get(index),keyframes,duration));
 let observer;
 if(rail&&dx&&typeof MutationObserver==='function'){
  observer=new MutationObserver(records=>{for(const record of records)for(const cell of record.addedNodes){const index=Number(cell.dataset?.virtualIndex);if(cell.animate&&Number.isFinite(index)&&side(index))animations.push(play(cell,shiftFrames(dx),0));}});
  observer.observe(track,{childList:true});
 }
 let active=true;const marked=Boolean(animations.length||observer);if(marked)shiftBy(group,1);
 return {scroll,cleanup(instant=false){if(!active)return;active=false;observer?.disconnect();settle(animations,instant);if(!marked)return;if(instant)shiftBy(group,-1);else Promise.all(animations.map(animation=>animation.finished?.catch(()=>{}))).then(()=>shiftBy(group,-1));}};
}
export function reserveCardExpansion(anchor,box,panel,tv=false,align='start'){
 const group=anchor.closest('[data-virtual-kind]'),selected=group&&anchor.closest('[data-virtual-index]');if(!group||!selected)return {cleanup(){},scroll:0};
 if(tv)return makeRoom(group,selected,box,panel,align);
 const index=Number(selected.dataset.virtualIndex),rail=group.dataset.virtualKind==='rail',end=rail&&align==='end',columns=Number(group.dataset.virtualColumns)||1,row=Math.floor(index/columns),track=rail?group.querySelector('.virtual-rail-track'):group;
 const oldMinWidth=track.style.minWidth,oldMinHeight=track.style.minHeight,shifts=[],nodes=new Map();
 // Read the rail before sizing the track, avoiding a forced layout between the writes and the scroll measurement.
 const bounds=rail?group.getBoundingClientRect():null,left=rail?parseFloat(selected.style.left):0,padding=rail?parseFloat(getComputedStyle(group).paddingLeft)||0:0,offset=group.scrollLeft;
 const extra=Math.max(0,panel.width-box.width),before=Math.max(0,box.left-panel.left),after=Math.max(0,panel.left+panel.width-box.right),below=Math.max(0,panel.top+panel.height-box.bottom-20);
 for(const cell of group.querySelectorAll(':scope > .virtual-grid-cell, .virtual-rail-track > .virtual-rail-cell')){
  const cellIndex=Number(cell.dataset.virtualIndex);let x=0,y=0;
  if(rail)x=end?(cellIndex<index?-extra:0):cellIndex>index?extra:0;
  else{const cellRow=Math.floor(cellIndex/columns);if(cellRow===row)x=cellIndex<index?-before:cellIndex>index?after:0;else if(cellRow>row)y=below;}
  if(x||y){shifts.push([cellIndex,x,y]);nodes.set(cellIndex,cell);}
 }
 const {move}=durations(false),animations=neighbourMotions({shifts,move}).map(({index,keyframes,duration})=>play(nodes.get(index),keyframes,duration));
 let scroll=0;
 if(rail){
  if(!end)track.style.minWidth=`${parseFloat(track.style.width)+extra}px`;
  const visibleLeft=bounds.left+padding,visibleRight=Math.min(window.innerWidth-16,bounds.right-16),panelLeft=box.left+box.width-panel.width;
  // F2: a left-opening panel past the visible left edge scrolls the rail left once (the left cells moved off-track need no room).
  const next=end?(panelLeft<visibleLeft?Math.max(0,offset-(visibleLeft-panelLeft)):offset):box.left<visibleLeft?Math.max(0,left-padding):box.left+panel.width>visibleRight?offset+box.left+panel.width-visibleRight:offset;
  if(Math.abs(next-offset)>1){group.scrollTo({left:next,behavior:'instant'});scroll=group.scrollLeft-offset;}
 }else if(below){track.style.minHeight=`${parseFloat(track.style.height)+below}px`;}
 let active=true;
 return {scroll,cleanup(instant=false){if(!active)return;active=false;settle(animations,instant);track.style.minWidth=oldMinWidth;track.style.minHeight=oldMinHeight;}};
}
