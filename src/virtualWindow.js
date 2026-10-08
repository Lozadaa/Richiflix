// The DOM budget depends on the viewport, never on catalogue length.
// R5.1 grid hysteresis: `previous` ({start,end} rows) stays while the visible band, widened by half a row on each
// side, is still inside it; past that the window is rebuilt with `overscan` rows around it. R5.2/R5.3: always
// ⌈viewport/rowHeight⌉+2·overscan rows, shifted inward at the ends: the full budget mounts once, the first Down
// mounts nothing and every later change is a pure shift whose cells are reused.
export function rowWindow({count,columns,rowHeight,offset=0,viewport=0,overscan=2,focusedIndex=-1,previous}){
 const totalRows=Math.ceil(count/columns),top=Math.max(0,offset),first=Math.max(0,Math.min(totalRows-1,Math.floor(top/rowHeight)));
 const last=Math.min(totalRows,Math.max(first+1,Math.ceil((top+viewport)/rowHeight)));
 const keep=previous&&previous.end<=totalRows&&previous.start<=Math.max(0,Math.floor((top-rowHeight/2)/rowHeight))&&previous.end>=Math.min(totalRows,Math.ceil((top+viewport+rowHeight/2)/rowHeight));
 const size=Math.min(totalRows,Math.ceil(viewport/rowHeight)+2*overscan),start=keep?previous.start:Math.max(0,Math.min(first-overscan,totalRows-size)),end=keep?previous.end:start+size,indices=[];
 for(let index=start*columns;index<Math.min(count,end*columns);index++)indices.push(index);
 if(focusedIndex>=0&&focusedIndex<count&&!indices.includes(focusedIndex))indices.push(focusedIndex);
 return {start,end,indices,totalRows};
}
// R5.1/R5.2 rail hysteresis. The window always holds ⌈viewport/stride⌉+2·overscan cells, the same size at any
// scroll offset (so every change is a pure shift whose cells can all be reused) and shifted inward at the ends (so a
// fresh row already has its 3 cells of overscan and the first keys mount nothing). `previous` ({start,end}) stays
// while the visible cells keep overscan−band cells of margin inside it; past that the window is rebuilt ahead of
// the motion (overscan−band behind, overscan+band ahead): 20 Right keys over 8 visible cells change it twice.
export function railWindow({count,itemWidth,gap=0,offset=0,viewport=0,overscan=3,band=2,focusedIndex=-1,previous}){
 const stride=itemWidth+gap,left=Math.max(0,offset),first=Math.max(0,Math.min(count-1,Math.floor(left/stride))),last=Math.min(count,Math.max(first+1,Math.ceil((left+viewport)/stride)));
 const margin=Math.max(0,overscan-band),indices=[],size=Math.min(count,Math.ceil(viewport/stride)+2*overscan);let start,end;
 // Ola 4: a window of another size (the rail gained or lost the focus, so its overscan changed) is rebuilt.
 if(previous&&previous.end<=count&&previous.end-previous.start===size&&previous.start<=Math.max(0,first-margin)&&previous.end>=Math.min(count,last+margin))({start,end}=previous);
 else{
  const forward=previous&&last+margin>previous.end,backward=previous&&first-margin<previous.start;
  const behind=Math.max(0,Math.min(forward&&!backward?margin:backward&&!forward?overscan+band:overscan,size-(last-first)-margin));
  start=Math.max(0,Math.min(first-behind,count-size));end=start+size;
 }
 for(let index=start;index<end;index++)indices.push(index);
 if(focusedIndex>=0&&focusedIndex<count&&!indices.includes(focusedIndex))indices.push(focusedIndex);
 return {start,end,indices};
}
export function nextGridIndex(index,key,columns,count){
 if(index<0||index>=count)return null;
 const column=index%columns;
 if(key==='ArrowLeft')return column>0?index-1:null;
 if(key==='ArrowRight')return column<columns-1&&index+1<count?index+1:null;
 if(key==='ArrowUp')return index-columns>=0?index-columns:null;
 if(key==='ArrowDown')return index+columns<count?index+columns:Math.floor(index/columns)<Math.floor((count-1)/columns)?count-1:null;
 return null;
}
// Kingdom A1, TV rails with a fixed focus column (Netflix): every focused card, the first and the last included,
// sits at x = paddingLeft (the row title's x); the previous card peeks in the screen margin, outside the column
// (A2: the rail bleeds to the screen edges). A reserved, empty tail lets the last item (including «Ver todo») reach
// the column even in a short row. The tail extends the track's overflow, which includes leading padding but not
// trailing padding, so max is the actual scroll range: (count-1)*stride.
export function railTailSpace({itemWidth,paddingLeft=0,viewport}){return Math.max(0,viewport-paddingLeft-itemWidth);}
export function anchoredRailOffset({index,count,itemWidth,gap=0,paddingLeft=0,viewport}){
 const stride=itemWidth+gap,max=Math.max(0,count*stride-gap+paddingLeft+railTailSpace({itemWidth,paddingLeft,viewport})-viewport);
 if(!Number.isInteger(index)||index<0||index>=count)return 0;
 return Math.max(0,Math.min(max,index*stride));
}
export function nextRailIndex(index,key,count){
 if(!Number.isInteger(count)||count<1||!Number.isInteger(index)||index<0||index>=count||!['ArrowLeft','ArrowRight'].includes(key))return null;
 return (index+(key==='ArrowRight'?1:-1)+count)%count;
}
// A queued scroll window may commit after the next remote key. Keep the focus
// that exists at commit time, rather than recycling its just-focused button.
export function pinWindowFocus(indices,index,count){
 return Number.isInteger(index)&&index>=0&&index<count&&!indices.includes(index)?[...indices,index]:indices;
}
export const sameIndices=(previous,next)=>previous.length===next.length&&previous.every((index,position)=>index===next[position]);
// R5.3 node reuse. Each mounted key (item id) keeps its slot while it stays in the window, so the focused card and
// the one with the open panel never change node; keys that enter take the slots freed by keys that left, so React
// hands the same DOM cell a new item instead of unmounting one and mounting another. reuse=false (a rail refresh
// driven by its own scroll, which may be the open panel's room-making scroll: its MutationObserver shifts only
// added cells) holds the freed slots for one round, so entering keys get fresh nodes. Idempotent for equal keys.
export function assignSlots(previous,keys,reuse=true){
 const next=new Map(),taken=new Set();
 for(const key of keys)if(previous.has(key)){const slot=previous.get(key);next.set(key,slot);taken.add(slot);}
 if(!reuse)for(const slot of previous.values())taken.add(slot);
 let free=0;
 for(const key of keys)if(!next.has(key)){while(taken.has(free))free++;next.set(key,free);taken.add(free);}
 return next;
}
// Ola 3-F row halo: one composited halo per rail/grid, placed from the model on focusin (no React, no layout
// reads) at the cell's card-open box (card-open sits at the cell origin, full cell width). Kingdom A2: a rail's halo
// lives outside the sliding track, fixed at the focus column (paddingLeft, paddingTop of the rail in .rail-wrap): the
// rail offset defaults to the anchored one. A pointer hover passes the actual offset (the card may be off the column).
export function haloPlacement({index,kind='rail',width,gap=0,columns=1,rowHeight=0,paddingLeft=0,paddingTop=0,offset=index*(width+gap)}){
 if(!(index>=0))return null;
 return kind==='grid'?{x:paddingLeft+(index%columns)*(width+gap),y:paddingTop+Math.floor(index/columns)*rowHeight}:{x:paddingLeft+index*(width+gap)-offset,y:paddingTop};
}
// The same lift as the focused .card-open (translateY(-6px) scale(--tv-focus-scale), origin at the box centre).
export const haloFrames=({x,y},scale=1.06,lift=6)=>[{transform:`translate3d(${x}px,${y}px,0)`},{transform:`translate3d(${x}px,${y-lift}px,0) scale(${scale})`}];
// Ola 3-F background pre-mount. rails: page order, {near, cells (mounted now), size (cells it would mount)}.
// After a rest, the first rail not yet near within 3 rows in the direction of the last vertical move mounts, if the
// global mounted-card budget allows it. 64 = the one-screen band (~50 cards on Inicio) + one 14-card rail.
export const PREMOUNT_BUDGET=64;
export function premountTarget({rails,active,direction=1,budget=PREMOUNT_BUDGET}){
 if(!Array.isArray(rails)||!(active>=0)||active>=rails.length||!direction)return -1;
 const mounted=rails.reduce((sum,rail)=>sum+rail.cells,0),step=direction>0?1:-1;
 for(let index=active+step,hops=0;index>=0&&index<rails.length&&hops<3;index+=step,hops++){
  if(rails[index].near)continue;
  return mounted+rails[index].size<=budget?index:-1;
 }
 return -1;
}
