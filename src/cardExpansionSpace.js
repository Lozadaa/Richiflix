// Reserve the expanded footprint once at rest. Neighbours animate with GPU
// transforms; logical indices, base measurements and the DOM budget stay fixed.
import {leaseTransformLayers} from './motionLayers.js';
export function reserveCardExpansion(anchor,box,panel){
 const group=anchor.closest('[data-virtual-kind]'),selected=anchor.closest('[data-virtual-index]');if(!group||!selected)return {cleanup(){},moved:false};
 const index=Number(selected.dataset.virtualIndex),rail=group.dataset.virtualKind==='rail',columns=Number(group.dataset.virtualColumns)||1,row=Math.floor(index/columns),track=rail?group.querySelector('.virtual-rail-track'):group;
 const oldMinWidth=track.style.minWidth,oldMinHeight=track.style.minHeight,changes=[];
 // Read the rail before writing transforms/track size, avoiding a forced
 // layout between the neighbours' mutations and the scroll measurement.
 const bounds=rail?group.getBoundingClientRect():null,left=rail?parseFloat(selected.style.left):0,padding=rail?parseFloat(getComputedStyle(group).paddingLeft)||0:0,offset=group.scrollLeft;
 const extra=Math.max(0,panel.width-box.width),before=Math.max(0,box.left-panel.left),after=Math.max(0,panel.left+panel.width-box.right),below=Math.max(0,panel.top+panel.height-box.bottom-20);
 for(const cell of group.querySelectorAll(':scope > .virtual-grid-cell, .virtual-rail-track > .virtual-rail-cell')){
  const cellIndex=Number(cell.dataset.virtualIndex);let x=0,y=0;
  if(rail)x=cellIndex>index?extra:0;
  else{const cellRow=Math.floor(cellIndex/columns);if(cellRow===row)x=cellIndex<index?-before:cellIndex>index?after:0;else if(cellRow>row)y=below;}
  if(x||y)changes.push([cell,cell.style.transform,`translate3d(${x}px,${y}px,0)`]);
 }
 leaseTransformLayers(changes.map(([cell])=>cell));
 for(const [cell,,transform]of changes)cell.style.transform=transform;
 let moved=false;
 if(rail){
  track.style.minWidth=`${parseFloat(track.style.width)+extra}px`;
  const visibleLeft=bounds.left+padding,visibleRight=Math.min(window.innerWidth-16,bounds.right-16);
  const next=box.left<visibleLeft?Math.max(0,left-padding):box.left+panel.width>visibleRight?offset+box.left+panel.width-visibleRight:offset;
  if(Math.abs(next-offset)>1){group.scrollTo({left:next,behavior:'instant'});moved=true;}
 }else if(below){track.style.minHeight=`${parseFloat(track.style.height)+below}px`;}
 let active=true;
 return {moved,cleanup(){if(!active)return;active=false;leaseTransformLayers(changes.map(([cell])=>cell));for(const [cell,transform]of changes)cell.style.transform=transform;track.style.minWidth=oldMinWidth;track.style.minHeight=oldMinHeight;}};
}
