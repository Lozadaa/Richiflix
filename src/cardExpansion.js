const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
// align: 'start' (left edge on the card), 'end' (right edge on the card) or 'center'; alignStart:true is 'start'.
export function expandedCardPlacement(anchor,viewport,{tv=false,live=false,tall=false,alignStart=false,align=alignStart?'start':'center',margin=16}={}){
 const availableWidth=viewport.width-2*margin,availableHeight=viewport.height-2*margin;
 if(anchor.width<=0||anchor.height<=0||availableWidth<200||availableHeight<240||anchor.bottom<=viewport.top||anchor.top>=viewport.top+viewport.height)return null;
 const width=Math.min(availableWidth,Math.min(tv?1120:620,Math.max(tv?1000:420,anchor.width*(tv?2.8:1.95))));
 const height=Math.min(availableHeight,Math.min(520,Math.max(tall?400:live?270:tv?360:390,anchor.height*(tv?1:1.12))));
 const left=clamp(align==='start'?anchor.left:align==='end'?anchor.left+anchor.width-width:anchor.left+(anchor.width-width)/2,viewport.left+margin,viewport.left+viewport.width-margin-width);
 const top=clamp(anchor.top+(anchor.height-height)/2,viewport.top+margin,viewport.top+viewport.height-margin-height);
 return {left,top,width,height};
}
// Top edge of the panel's viewport: below the row heading in rails; in grids below the grid's
// top and the catalogue controls (count and chips), whichever is lower. Undefined edges are ignored.
export function expansionViewportTop({mainTop=0,boxTop,headingBottom,gridTop,controlsBottom}){
 return Math.max(0,mainTop,headingBottom!==undefined&&headingBottom<boxTop?headingBottom+24:0,gridTop??0,controlsBottom!==undefined&&controlsBottom<=boxTop?controlsBottom:0);
}
// Anchor geometry comes from the layout model: the untransformed container's
// rect plus the cell's numeric left/top. Neighbour transforms, card focus scale
// and in-flight transitions never move it. scrollDelta applies a pending rail scroll.
export function anchorBoxFromLayout({trackRect,left=0,top=0,width,height,scrollDelta=0}){
 const x=trackRect.left+left-scrollDelta,y=trackRect.top+top;
 return {left:x,top:y,width,height,right:x+width,bottom:y+height};
}
// Virtual cells sit at numeric left/top inside an untransformed track or grid;
// read those, never the cell rect, which includes neighbour transitions.
export function cellAnchorBox(cell){
 const track=cell.parentElement;if(!cell.matches('.virtual-rail-cell,.virtual-grid-cell')||!track)return cell.getBoundingClientRect();
 const rect=track.getBoundingClientRect();
 return anchorBoxFromLayout({trackRect:{left:rect.left+track.clientLeft,top:rect.top+track.clientTop},left:parseFloat(cell.style.left)||0,top:parseFloat(cell.style.top)||0,width:parseFloat(cell.style.width)||cell.offsetWidth,height:cell.offsetHeight});
}
// Fase F2: a rail panel opens toward the side already seen. Past the rail's middle (card centre relative to
// its viewport) it opens left ('end'); ±half a card of hysteresis around the middle keeps the previous side, so
// one key near the middle never flips it. 'end' needs room: the panel must fit left of the card's right edge.
export function expansionAlignFor({cellLeft,cellWidth,scrollLeft,viewportWidth,previous,panelWidth=0}){
 if(cellLeft+cellWidth<panelWidth)return 'start';
 const offset=cellLeft-scrollLeft+cellWidth/2-viewportWidth/2;
 return offset>(previous==='end'?-cellWidth/2:previous==='start'?cellWidth/2:0)?'end':'start';
}
// Fase F: where each neighbour goes when the TV panel opens (pure: model boxes in, translations out).
// Rail: cells right of the anchor slide panel.right-anchor.right (the gap is kept), the left ones stay; a
// panel past viewportRight scrolls the rail once (scroll, applied before placing). F2, rail align 'end': mirror
// image, the cells left of the anchor slide -(panel.width-card.width), a panel past viewportLeft scrolls left
// (scroll<0). Grid: only the anchor's row moves right; a cell that would cross viewportRight fades instead.
// Anything still under the panel fades.
export function neighbourShifts({cells,anchorIndex,panel,kind,columns=1,viewportRight,viewportLeft=0,align='start'}){
 const anchor=cells.find(cell=>cell.index===anchorIndex);if(!anchor)return {shifts:[],faded:[],scroll:0};
 const rail=kind==='rail',end=rail&&align==='end',row=Math.floor(anchorIndex/columns),anchorRight=anchor.left+anchor.width;
 const scroll=!rail?0:end?Math.min(0,anchorRight-panel.width-viewportLeft):Math.max(0,anchor.left+panel.width-viewportRight);
 // Pre-scroll frame: after the scroll the rail panel starts (ends) at its card, or at the margin it was clamped to.
 const placed=!rail?panel:end?{...panel,left:Math.min(anchorRight-panel.width,panel.left)}:{...panel,left:Math.max(anchor.left,panel.left)};
 const dx=end?Math.min(0,placed.left-anchor.left):Math.max(0,placed.left+placed.width-anchorRight),shifts=[],faded=[];
 for(const cell of cells){
  if(cell.index===anchorIndex)continue;
  let x=(end?cell.index<anchorIndex:cell.index>anchorIndex)&&(rail||Math.floor(cell.index/columns)===row)?dx:0;
  if(!rail&&x&&cell.left+x+cell.width>viewportRight+.5){faded.push(cell.index);continue;}
  if(cell.left+x<placed.left+placed.width&&cell.left+x+cell.width>placed.left&&cell.top<placed.top+placed.height&&cell.top+cell.height>placed.top){faded.push(cell.index);continue;}
  if(x)shifts.push([cell.index,x]);
 }
 return {shifts,faded,scroll};
}
// R1.1: neighbours move by Web Animations (pure plan here, cardExpansionSpace applies it). A shift slides
// (transform), a covered cell fades (opacity); a cell visible neither before nor after its move jumps
// (duration 0). Durations follow the F9 knob: TV --tv-base/--tv-fast (Samsung 90/60 ms, else 110/80), PC 220;
// reduced motion jumps.
export const NEIGHBOUR_EASE='cubic-bezier(.22,1,.36,1)';
export const shiftFrames=(x,y=0)=>[{transform:'none'},{transform:`translate3d(${x}px,${y}px,0)`}];
export function neighbourDurations({tv=false,samsung=false,reduced=false}){
 return reduced?{move:0,fade:0}:tv?{move:samsung?90:110,fade:samsung?60:80}:{move:220,fade:220};
}
export function neighbourMotions({shifts=[],faded=[],visible=()=>true,move,fade=move}){
 return [...shifts.map(([index,x,y=0])=>({index,keyframes:shiftFrames(x,y),duration:visible(index,x)?move:0})),...faded.map(index=>({index,keyframes:[{opacity:1},{opacity:0}],duration:visible(index,0)?fade:0}))];
}
// R1.2/R1.3: one set of window/document listeners for every expansion, added once on the first register; each
// event goes to the registered controllers (the selected card's, normally one). Nothing is added or removed per
// key. retire() and schedule() defer work to the next animation frame: the reservations of a card left behind
// are cancelled there, then each controller's frame() runs (a navigation-requested hide). flushRetired() lets an
// opening due earlier apply them in its own batch.
export function createExpansionHub({win=globalThis.window,doc=globalThis.document,request=callback=>win.requestAnimationFrame(callback)}={}){
 const controllers=new Set(),retired=[];let installed=false,scheduled=false;
 const each=method=>event=>{for(const controller of [...controllers])controller[method]?.(event);};
 const flushRetired=()=>{for(const space of retired.splice(0))space.cleanup(true);};
 const flush=()=>{scheduled=false;flushRetired();for(const controller of [...controllers])controller.frame?.();};
 const schedule=()=>{if(scheduled)return;scheduled=true;request(flush);};
 const install=()=>{
  installed=true;win.addEventListener('focusin',each('focus'));win.addEventListener('pointermove',each('move'),{passive:true});win.addEventListener('scroll',each('scroll'),true);win.addEventListener('resize',each('scroll'));
  win.addEventListener('richiflix-catalog-navigation',each('navigate'));win.addEventListener('richiflix-preview-layout',each('reflow'));doc.addEventListener('visibilitychange',each('visibility'));
 };
 return {register(controller){if(!installed)install();controllers.add(controller);return()=>{controllers.delete(controller);};},retire(space){if(!space)return;retired.push(space);schedule();},schedule,flushRetired,get size(){return controllers.size;}};
}
// Rest before a focused card opens its panel (the smoke reads it too).
export const EXPANSION_DELAY_MS=180;
export function createCardPress({short,long,delay=500,schedule=setTimeout,cancel=clearTimeout}){
 let timer,pressed=false,held=false;
 return {down(){if(pressed)return;pressed=true;held=false;timer=schedule(()=>{timer=undefined;if(pressed){held=true;long();}},delay);},up(){if(!pressed)return false;cancel(timer);timer=undefined;pressed=false;const wasHeld=held;held=false;if(!wasHeld)short();return true;},cancel(){cancel(timer);timer=undefined;pressed=false;held=false;},get pressed(){return pressed;}};
}
// «Mantén OK para opciones» shows on the first three expansions per profile;
// a real long press proves the gesture is known and retires it at once.
export const OK_HINT_LIMIT=3;
export function okHint(profileId,storage=globalThis.localStorage){
 const key=`rf-ok-hint:${profileId}`,read=()=>{try{return Number(storage.getItem(key))||0;}catch{return OK_HINT_LIMIT;}},write=value=>{try{storage.setItem(key,String(value));}catch{}};
 return {visible:()=>read()<OK_HINT_LIMIT,shown:()=>write(Math.min(OK_HINT_LIMIT,read()+1)),mastered:()=>write(OK_HINT_LIMIT)};
}
// «Te quedan 42 min» from seconds watched and total seconds.
export const remainingLabel=(progress,duration)=>{if(!(progress>0&&duration>progress))return '';const minutes=Math.ceil((duration-progress)/60);return `Te ${minutes===1?'queda':'quedan'} ${minutes} min`;};
