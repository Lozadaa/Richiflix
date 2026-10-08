import {useStableEvent} from './useStableEvent.js';
import React,{memo,startTransition,useCallback,useEffect,useId,useLayoutEffect,useMemo,useReducer,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {ChevronLeft,ChevronRight,ArrowUpRight,LayoutGrid} from 'lucide-react';
import {Card,motionAllowed} from './interactions.jsx';
import {displayText} from './displayText.js';
import {railWindow,sameIndices,nextRailIndex,pinWindowFocus,assignSlots,haloPlacement,haloFrames,premountTarget,anchoredRailOffset,railTailSpace} from './virtualWindow.js';
import {registerVirtualNavigation,virtualCardIndex,haloMotion,liftHalo,cellsShifted,markFarRows,revealRowFor} from './virtualNavigation.js';
import {revealRailCard,scrollViewport,viewportOffset,knownViewportTop,viewportIsGliding,cancelViewportGlide,glideShiftAt} from './virtualViewport.js';
import './virtualCatalogue.css';

// TV active row: one attribute toggle per row change (h2 colour, paint only),
// outside React, from one document focusin listener shared by every rail. Leaving every row (header, banner) dims them all; the expanded
// card belongs to its row, so focus inside it keeps the row lit.
let activeRow=null,watchingRows=false;
// Ola 4: rows more than one row away from the active one stop painting (data-row-far → their track, heading and footer
// visibility:hidden,
// compositorMotion.css). The TV re-layerized every mounted row on each repaint (PaintArtifactCompositor 45 ms per
// update with the focus three rows down, 8–15 ms with only the active row and its neighbours painted). The scene
// shows one row at a time, so a far row is never on screen; the marks are applied off the key's frame (idle), and a
// programmatic focus into a far row (remembered card, restore) calls revealRowFor first (virtualNavigation.js), since
// hidden nodes can't focus.
// Default is visible: a row mounted later, or no active row (banner, header), paints as before.
let farTask=0,hideTimer=0;
// hide=false only reveals (a row coming near); rows are hidden later, once a vertical glide (≤ 220 ms) has landed, so a
// row still sliding out of view is never blanked.
const scheduleFarRows=()=>{if(!globalThis.document?.querySelector('.tv-mode'))return;
 if(!farTask){const run=()=>{farTask=0;markFarRows(activeRow,false);};farTask=globalThis.requestIdleCallback?requestIdleCallback(run,{timeout:150}):setTimeout(run,50);}
 clearTimeout(hideTimer);hideTimer=setTimeout(()=>markFarRows(activeRow),260);};
const activateRow=row=>{if(activeRow===row)return;activeRow?.removeAttribute('data-active-row');activeRow=row;row?.setAttribute('data-active-row','');scheduleFarRows();};
// Ola 3-F(b) pre-mount: TV rails register by row. 300 ms after the last catalogue focus move, the next rail not yet
// mounted in the direction of the last vertical move mounts in a transition (premountTarget, <= PREMOUNT_BUDGET
// mounted cards), so the next Down finds it ready; a pre-mounted rail never reached is released at the next rest.
const MOUNT_STEP=4,PREMOUNT_REST_MS=300,premountRails=new Map();let lastDirection=1,restTimer=0;
const premount=()=>{
 restTimer=0;const rows=[...document.querySelectorAll('.catalog-row')].filter(row=>premountRails.has(row)),entries=rows.map(row=>premountRails.get(row)),stale=entry=>entry.premounted&&!entry.intersecting;
 const target=premountTarget({rails:entries.map(entry=>stale(entry)?{near:false,cells:0,size:entry.size()}:{near:entry.near(),cells:entry.cells(),size:entry.size()}),active:rows.indexOf(activeRow),direction:lastDirection});
 entries.forEach((entry,index)=>{if(index!==target&&stale(entry))entry.show(false);});
 if(target>=0&&!entries[target].near())entries[target].show(true);
};
const watchRows=()=>{if(watchingRows)return;watchingRows=true;document.addEventListener('focusin',event=>{const target=event.target;if(!target?.closest||target.closest('.card-expansion'))return;const row=target.closest('.catalog-row');
 if(row&&activeRow&&row!==activeRow)lastDirection=activeRow.compareDocumentPosition(row)&Node.DOCUMENT_POSITION_FOLLOWING?1:-1;
 activateRow(row);if(row&&premountRails.size){clearTimeout(restTimer);restTimer=setTimeout(premount,PREMOUNT_REST_MS);}});};
export const VirtualCarousel=memo(function VirtualCarousel({title,items,metadata,open,history,favorites,toggle,viewAll,actionFocus,preview,pointerPreview,leave,tv,warmWindow,resolvedMetadata,profileId,kids,freshIds,variant}){
 const rail=useRef(),probe=useRef(),heights=useRef(),progress=useRef(),focused=useRef(-1),snapshot=useRef(),pending=useRef(),nearRef=useRef(true),railOffset=useRef(null),selfScroll=useRef(false),win=useRef(null),shown=useRef(),edges=useRef(),slots=useRef(new Map()),reuse=useRef(false),halo=useRef(),haloAt=useRef(null),glide=useRef(null),motion=useRef({duration:110,scale:1.06}),id=useId();
 const [,force]=useReducer(n=>n+1,0),haloRef=useCallback(node=>{halo.current=node;haloAt.current=null;},[]);
 const live=useMemo(()=>items.length>0&&items.every(item=>item.kind==='iptv'),[items]),favoriteIds=useMemo(()=>new Set(favorites),[favorites]);
 const count=items.length+Number(Boolean(viewAll));
 const [layout,setLayout]=useState({width:tv?210:190,gap:tv?30:16,height:420,viewportWidth:1920,paddingLeft:0,paddingRight:0}),[indices,setIndices]=useState(()=>(win.current=railWindow({count,itemWidth:tv?210:190,gap:tv?30:16,viewport:1920})).indices),[position,setPosition]=useState({start:true,end:count<2});
 const [warmNear,setWarmNear]=useState(true);
 const [near,setNear]=useState(true),[pin,setPin]=useState(-1),[budget,setBudget]=useState(Infinity),wanted=useRef(0);
 snapshot.current={items,layout,count};shown.current=indices;edges.current=position;
 useEffect(()=>{const element=rail.current,viewport=scrollViewport(element),margin=2*(layout.height+90),observer=new IntersectionObserver(entries=>{const value=entries[0].isIntersecting;startTransition(()=>setWarmNear(value));},{root:viewport===window?null:viewport,rootMargin:`280px 0px ${margin}px 0px`,threshold:0});observer.observe(element);return()=>observer.disconnect();},[layout.height,tv]);
 // Third argument (Fase G): the window even when the row is far, for poster prefetch.
 useEffect(()=>{const visible=indices.filter(index=>index<items.length).map(index=>items[index]);return warmWindow?.(id,warmNear?visible:[],visible);},[items,indices,warmNear,warmWindow,id]);
 const focusedPreview=useStableEvent((item,id,index)=>preview?.(item,id,{items:snapshot.current.items,index,columns:snapshot.current.layout.columns||1,kind:'rail',loop:true}));
 const pointedPreview=useStableEvent((item,event,id)=>pointerPreview?.(item,event,id,{items:snapshot.current.items,index:virtualCardIndex(event.currentTarget),columns:snapshot.current.layout.columns||1,kind:'rail',loop:true}));
 // R5.1/R5.5: the window moves only past the hysteresis band (railWindow `previous`) and state is set only on a
 // real change, so a scroll inside the window (a key's own scrollTo included) renders nothing.
 const placeHalo=(index,offset)=>{const node=halo.current,{layout}=snapshot.current,at=node&&haloPlacement({index,width:layout.width,gap:layout.gap,paddingLeft:layout.haloX,paddingTop:layout.haloY,offset});if(!at)return;const key=`${at.x},${at.y}`;if(haloAt.current===key)return;haloAt.current=key;liftHalo(node,haloFrames(at,motion.current.scale),motion.current.duration);};
 const commit=(next,recycle)=>{win.current=next;const pinned=pinWindowFocus(next.indices,focused.current,snapshot.current.count);if(sameIndices(shown.current,pinned))return false;reuse.current=recycle;shown.current=pinned;setIndices(pinned);return true;};
 // Ola 3-F(a): a refresh driven by the rail's own scroll publishes in a transition (never inside the key's frame).
 const refresh=defer=>{
  const element=rail.current;if(!element)return;const {count,layout}=snapshot.current;
  const offset=railOffset.current??element.scrollLeft,viewport=layout.viewportWidth;railOffset.current=offset;
  const tail=tv?railTailSpace({...layout,itemWidth:layout.width,viewport}):0,max=Math.max(0,count*(layout.width+layout.gap)-layout.gap+layout.paddingLeft+(tv?0:layout.paddingRight)+tail-viewport),start=offset<6,end=max<6||offset>=max-6;
  // Ola 4: only the rail holding the focus keeps overscan 3; the others mount what the screen shows plus one per side
  // (they are only seen whole during a vertical glide), about a third fewer cards painted and layerized per row.
  const publish=()=>{commit(railWindow({count,itemWidth:layout.width,gap:layout.gap,offset,viewport,overscan:tv&&focused.current<0?1:3,focusedIndex:focused.current,previous:win.current}),false);if(edges.current.start!==start||edges.current.end!==end){edges.current={start,end};setPosition(edges.current);}};
  if(defer===true)startTransition(publish);else publish();
  if(progress.current)progress.current.style.transform=`translateX(${max>0?offset/max*200:0}%)`;
 };
 useLayoutEffect(()=>{
  const element=rail.current;let frame,lastWidth=-1;
  const measure=()=>{
   const style=getComputedStyle(probe.current),basis=style.flexBasis;probe.current.style.width=basis==='auto'?'210px':basis;
   const width=probe.current.offsetWidth,railStyle=getComputedStyle(element),gap=parseFloat(railStyle.columnGap)||0,viewportWidth=element.clientWidth,paddingLeft=parseFloat(railStyle.paddingLeft)||0,paddingRight=parseFloat(railStyle.paddingRight)||0,haloX=element.offsetLeft+paddingLeft,haloY=element.offsetTop+(parseFloat(railStyle.paddingTop)||0);
   motion.current=haloMotion(railStyle);
   if(width>0)setLayout(previous=>previous.width===width&&previous.gap===gap&&previous.viewportWidth===viewportWidth&&previous.paddingLeft===paddingLeft&&previous.paddingRight===paddingRight&&previous.haloX===haloX&&previous.haloY===haloY?previous:{...previous,width,gap,viewportWidth,paddingLeft,paddingRight,haloX,haloY});
  };
  measure();const observer=new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width===lastWidth)return;lastWidth=width;cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);});observer.observe(element);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();};
 },[tv,live]);
 // Track height follows the first mounted card. The observer re-targets only
 // when that card unmounts; its first callback lands before paint.
 useLayoutEffect(()=>{
  const state=heights.current||(heights.current={observer:new ResizeObserver(entries=>{const card=entries[entries.length-1].target,height=card.offsetHeight,openHeight=card.querySelector('.card-open')?.offsetHeight||0;if(height>0)setLayout(previous=>Math.abs(previous.height-height)>1||Math.abs((previous.openHeight||0)-openHeight)>1?{...previous,height,openHeight}:previous);})});
  if(state.card?.isConnected)return;const card=rail.current.querySelector('.virtual-rail-cell .card:not(.rail-more-card)');if(!card)return;state.observer.disconnect();state.observer.observe(card);state.card=card;
 });
 useEffect(()=>()=>{heights.current?.observer.disconnect();heights.current=null;},[]);
 useLayoutEffect(refresh,[layout,items,count]);
 useLayoutEffect(()=>{
  // R5.4: a row keeps its window while it is within one screen of the viewport (was 280 px), so rows passing
  // by on a vertical run do not mount and unmount their cells.
  const element=rail.current,viewport=scrollViewport(element);
  // Ola 3-F(a/c): rows entering or leaving that band mount/unmount in a transition, after the key's frame.
  const visible=(value,force)=>{if(!force&&nearRef.current===value)return;nearRef.current=value;reuse.current=false;const publish=()=>{setNear(value);setPin(value?-1:focused.current);if(tv&&value&&!force)setBudget(MOUNT_STEP);};if(force)publish();else startTransition(publish);};
  const bounds=element.getBoundingClientRect(),root=viewport===window?{top:0,bottom:window.innerHeight}:viewport.getBoundingClientRect(),margin=root.bottom-root.top;
  const entry={intersecting:bounds.bottom>=root.top-margin&&bounds.top<=root.bottom+margin,premounted:false,near:()=>nearRef.current,cells:()=>nearRef.current?shown.current.length:focused.current>=0?1:0,size:()=>win.current?.indices.length||0,show(value){entry.premounted=value;visible(value);}};
  visible(entry.intersecting,true);
  const observer=new IntersectionObserver(entries=>{entry.intersecting=entries[0].isIntersecting;if(entry.intersecting)entry.premounted=false;visible(entry.intersecting);},{root:viewport===window?null:viewport,rootMargin:'100% 0px',threshold:0});observer.observe(element);
  const row=tv&&element.closest('.catalog-row');if(row)premountRails.set(row,entry);
  return()=>{observer.disconnect();if(row&&premountRails.get(row)===entry)premountRails.delete(row);};
 },[tv]);
 useEffect(()=>{
  const element=rail.current,viewport=scrollViewport(element);let revealed;
  // TV: the scroll event of our own scrollTo keeps the known offset; reading scrollLeft there forced style+layout (~20 ms per key on the Samsung).
  const schedule=()=>{if(selfScroll.current)selfScroll.current=false;else railOffset.current=null;if(pending.current)return;pending.current=requestAnimationFrame(()=>{pending.current=null;refresh(true);});};
  const focus=event=>{const index=virtualCardIndex(event.target);if(index>=0){focused.current=index;if(tv)placeHalo(index);if(!nearRef.current)setPin(index);}};
  const blur=event=>{if(event.relatedTarget&&!element.contains(event.relatedTarget)){focused.current=-1;haloAt.current=null;setPin(-1);schedule();}};
  const point=event=>{const index=virtualCardIndex(event.target);if(index>=0&&index<snapshot.current.items.length)placeHalo(index,railOffset.current??element.scrollLeft);};
  watchRows();element.addEventListener('scroll',schedule,{passive:true});element.addEventListener('focusin',focus);element.addEventListener('focusout',blur);if(tv)element.addEventListener('pointerover',point);
  // Ola 4 (R1.6 for rails): one instant scrollTo to the destination and, in the same task, the track slides from the
  // drawn offset (translate3d compensating the jump) to 0 on the compositor, --tv-base long. A key mid-glide starts
  // from where the track is drawn; a wrap (end -> start) or reduced motion jumps.
  const glideRail=(offset,next)=>{
   const track=element.querySelector(':scope > .virtual-rail-track'),current=glide.current,{layout}=snapshot.current;
   const drawn=offset-(current?glideShiftAt(current.shift,current.animation.effect?.getComputedTiming().progress):0);
   current?.animation.cancel();glide.current=null;element.scrollTo({left:next,behavior:'instant'});
   const shift=next-drawn,duration=motion.current.duration;
   if(!track?.animate||!duration||Math.abs(shift)<1||Math.abs(shift)>2*(layout.width+layout.gap))return;
   const animation=track.animate([{transform:`translate3d(${shift}px,0,0)`},{transform:'translate3d(0,0,0)'}],{duration,easing:'cubic-bezier(.22,1,.36,1)'}),entry={shift,animation};
   glide.current=entry;animation.onfinish=()=>{if(glide.current===entry)glide.current=null;};
  };
  const focusIndex=index=>{
   const {count,layout}=snapshot.current;if(!Number.isInteger(index)||index<0||index>=count)return null;focused.current=index;
   // Ola 4: TV compares the scene offset known from its scroll events (reading scrollTop here forced a layout, ~9 ms
   // per key); PC reads it.
   const sceneOffset=tv?knownViewportTop(viewport):viewportOffset(viewport);
   let button=element.querySelector(`[data-virtual-index="${index}"] .card-open`);const inWindow=Boolean(button);
   // R1.7: inside the mounted window the rail offset comes from the last refresh or scroll written here (a scroll
   // event clears it); only a crossing reads scrollLeft. ponytail: a keydown between the panel's own rail scroll
   // and its scroll event uses the old offset once; the event's refresh corrects it.
   const left=layout.paddingLeft+index*(layout.width+layout.gap),right=left+layout.width,margin=24,offset=inWindow&&railOffset.current!==null?railOffset.current:element.scrollLeft;
   // Ola 4: TV rails keep the focus anchored left (anchoredRailOffset); PC keeps the edge-reveal scroll.
   const next=tv?anchoredRailOffset({index,count,itemWidth:layout.width,gap:layout.gap,paddingLeft:layout.paddingLeft,paddingRight:layout.paddingRight,viewport:layout.viewportWidth}):left<offset+margin?Math.max(0,left-margin):right>offset+layout.viewportWidth-margin?right-layout.viewportWidth+margin:offset;
   // R5.1/R5.3: the window for the offset this key lands on is decided here, once (the scroll event's refresh then
   // finds it unchanged), and entering cells reuse the nodes of the cells that left. A panel still open is cancelled
   // in the next frame, before paint, so a recycled cell never shows its old neighbour shift.
   const nextWindow=railWindow({count,itemWidth:layout.width,gap:layout.gap,offset:next,viewport:layout.viewportWidth,focusedIndex:index,previous:win.current});
   // Ola 3-F(a): the key only focuses and scrolls. A real crossing mounts just the target cell synchronously (focused
   // is pinned in any render); the rest of the window, and every hysteresis shift, publishes in a transition.
   const inside=element.contains(document.activeElement);
   if(!button){nearRef.current=true;flushSync(force);button=element.querySelector(`[data-virtual-index="${index}"] .card-open`);startTransition(()=>{setNear(true);setPin(-1);setBudget(Infinity);commit(nextWindow,true);});}
   else startTransition(()=>commit(nextWindow,true));
   // Ola 4: focus before this key's scroll and animation writes, so focus()'s focusability check finds the style clean.
   revealRowFor(element);button?.focus({preventScroll:true});
   if(next!==offset){selfScroll.current=true;if(tv)glideRail(offset,next);else element.scrollTo({left:next,behavior:'instant'});}railOffset.current=tv?next:next<=count*(layout.width+layout.gap)-layout.gap+layout.paddingLeft+layout.paddingRight-layout.viewportWidth?next:null;
   if(!revealed||revealed.layout!==layout||(Math.abs(revealed.offset-sceneOffset)>1&&!viewportIsGliding(viewport))||!inside){
    revealRailCard(element,index,viewport);revealed={layout,offset:tv?knownViewportTop(viewport):viewportOffset(viewport)};
   }
   return button;
  };
  const unregister=registerVirtualNavigation(element,{kind:'rail',focus:focusIndex,navigate(key,current){const next=nextRailIndex(virtualCardIndex(current),key,snapshot.current.count);return next===null?null:focusIndex(next);}});
  refresh();
  if(focused.current>=0&&element.contains(document.activeElement))focusIndex(focused.current);
  return()=>{unregister();glide.current?.animation.cancel();glide.current=null;cancelViewportGlide(viewport);cancelAnimationFrame(pending.current);pending.current=null;element.removeEventListener('scroll',schedule);element.removeEventListener('focusin',focus);element.removeEventListener('focusout',blur);element.removeEventListener('pointerover',point);};
 },[tv]);
 useEffect(()=>{if(!tv||budget>=wanted.current)return;const grow=()=>startTransition(()=>setBudget(value=>value+MOUNT_STEP));const task=globalThis.requestIdleCallback?requestIdleCallback(grow,{timeout:250}):setTimeout(grow,60);return()=>globalThis.cancelIdleCallback&&globalThis.requestIdleCallback?cancelIdleCallback(task):clearTimeout(task);});
 // Ola 3-F row halo: follows the focused index after any render (layout change, filtered items) without reads.
 useLayoutEffect(()=>{if(tv&&focused.current>=0)placeHalo(focused.current);});
 // R5.3: cells keyed by slot (assignSlots over item ids): a cell leaving one side is the node that enters on the
 // other, with a new item; instanceId stays per item. TV paints them in slot order (no DOM moves); PC keeps index
 // order for Tab. The «Ver todo» cell keeps its own key, outside the pool and last: a rail whose items arrive after
 // it mounted still starts with its first title (DOM order = index order until a key recycles cells).
 // Ola 4 (hint 1): a rail entering the one-screen band (or pre-mounted) mounts its window a few cells per idle
 // transition instead of 10–14 cards in one commit (one 60–130 ms task on the TV). It is off screen meanwhile; the
 // rail holding the focus always mounts whole.
 let windowCells=(near?pinWindowFocus(indices,focused.current,count):focused.current>=0?[focused.current]:pin>=0?[pin]:[]).filter(index=>index<count);
 wanted.current=windowCells.length;if(tv&&focused.current<0&&budget<windowCells.length)windowCells=windowCells.slice(0,budget);
 const viewAllKey=id+':view-all',cells=windowCells,slotOf=index=>index<items.length?slots.current.get(items[index].id):Infinity;
 slots.current=assignSlots(slots.current,cells.filter(index=>index<items.length).map(index=>items[index].id),reuse.current&&!(tv&&cellsShifted(rail.current)));
 if(tv)cells.sort((a,b)=>slotOf(a)-slotOf(b));
 const move=direction=>{const element=rail.current;if(direction<0&&position.start||direction>0&&position.end)element.scrollTo({left:direction<0?element.scrollWidth-element.clientWidth:0,behavior:'instant'});else element.scrollBy({left:direction*(element.clientWidth+15),behavior:motionAllowed()?'smooth':'instant'});};
 return <section className="catalog-row" aria-labelledby={id} data-warm-id={id}>
  <div className="row-heading"><h2 id={id}>{displayText(title)}</h2><div className="row-controls"><button className="rail-arrow" aria-label={`Anterior en ${title}`} disabled={count<2} onClick={()=>move(-1)}><ChevronLeft size={20}/></button><button className="rail-arrow" aria-label={`Siguiente en ${title}`} disabled={count<2} onClick={()=>move(1)}><ChevronRight size={20}/></button></div></div>
  <div className="rail-wrap virtual-rail-wrap"><div ref={rail} className={`cards virtual-rail ${variant==='ranked'?'is-ranked':''}`} aria-label={displayText(title)} data-virtual-kind="rail" data-virtual-count={count} data-virtual-item-count={items.length}>
   <div ref={probe} className={`card ${live?'live-card':'portrait-card'} virtual-rail-probe`} aria-hidden="true"/>
   <div className="virtual-rail-track" style={{width:Math.max(0,count*(layout.width+layout.gap)-layout.gap),height:layout.height,...(tv?{'--rail-tail':`${railTailSpace({...layout,itemWidth:layout.width,viewport:layout.viewportWidth})}px`}:{})}}>
    {cells.map(index=>{const item=items[index];return <div key={item?`s${slots.current.get(item.id)}`:viewAllKey} className="virtual-rail-cell" data-virtual-index={index} style={{width:layout.width,left:index*(layout.width+layout.gap),...(item?{}:{height:layout.height})}}>{item?<Card instanceId={`${id}:${item.id}`} item={item} metadata={metadata?.[item.id]} metadataPending={resolvedMetadata?!resolvedMetadata.has(item.id):false} open={open} progress={history[item.id]} favorite={favoriteIds.has(item.id)} toggle={toggle} index={index} total={items.length} preview={focusedPreview} pointerPreview={pointedPreview} leave={leave} tv={tv} profileId={profileId} kids={kids} fresh={Boolean(freshIds?.has(item.id))}/>:<div className={`card rail-more-card ${live?'live-card':'portrait-card'}`} data-card-id={`${id}:view-all`}><button className="card-open rail-more-open" aria-label={`Ver todo: ${displayText(title)}`} onClick={viewAll} onFocus={actionFocus}><span className="rail-more-symbol" aria-hidden="true"><LayoutGrid/></span><span className="rail-more-copy"><small>EXPLORAR</small><strong>Ver todo</strong><span>{displayText(title)}</span></span><span className="rail-more-count">{items.length.toLocaleString('es-CL')} {items.length===1?'título':'títulos'}</span><ArrowUpRight className="rail-more-arrow" aria-hidden="true"/></button></div>}</div>;})}
   </div>
  </div>{tv&&cells.length>0&&<i ref={haloRef} className="rail-halo" aria-hidden="true" style={{width:layout.width,height:layout.openHeight||layout.width*1.5}}/>}{!position.end&&<span className="rail-edge" aria-hidden="true"/>}</div>
  <div className="row-footer">{(!position.start||!position.end)&&<span className="rail-progress" aria-hidden="true"><i ref={progress}/></span>}</div>
 </section>;
});
