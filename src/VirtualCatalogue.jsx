import {useStableEvent} from './useStableEvent.js';
import React,{memo,startTransition,useCallback,useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {Card} from './interactions.jsx';
import {nextGridIndex,rowWindow,sameIndices,pinWindowFocus,assignSlots,haloPlacement,haloFrames} from './virtualWindow.js';
import {registerVirtualNavigation,virtualCardIndex,haloMotion,liftHalo,cellsShifted,revealRowFor} from './virtualNavigation.js';
import {revealGridIndex,scrollViewport,viewportHeight,viewportOffset,viewportIsGliding,cancelViewportGlide} from './virtualViewport.js';
import './virtualCatalogue.css';

const initialLayout={columns:7,width:210,rowHeight:420,gap:30,paddingTop:20,paddingBottom:28,paddingLeft:12};
// Keep catalogue objects and callbacks stable; the window is independent of banner state.
export const VirtualCatalogue=memo(function VirtualCatalogue({items,metadata,open,history,favorites,toggle,preview,pointerPreview,leave,tv,warmWindow,resolvedMetadata,instancePrefix='grid',profileId,kids}){
 const warmId=useId();
 const grid=useRef(),probe=useRef(),heights=useRef(),focused=useRef(-1),focusedId=useRef(),pending=useRef(),snapshot=useRef(),controller=useRef(),lastItems=useRef(items),win=useRef(null),shown=useRef(),slots=useRef(new Map()),halo=useRef(),haloAt=useRef(null),motion=useRef({duration:110,scale:1.06});
 const haloRef=useCallback(node=>{halo.current=node;haloAt.current=null;},[]);
 const [layout,setLayout]=useState(initialLayout),[indices,setIndices]=useState(()=>(win.current=rowWindow({count:items.length,columns:7,rowHeight:420,viewport:600,overscan:tv?1:2})).indices);
 const live=useMemo(()=>items.length>0&&items.every(item=>item.kind==='iptv'),[items]),favoriteIds=useMemo(()=>new Set(favorites),[favorites]);
 snapshot.current={items,layout};shown.current=indices;
 useEffect(()=>{const viewport=scrollViewport(grid.current),rect=grid.current.getBoundingClientRect(),top=viewport===window?0:viewport.getBoundingClientRect().top;const ahead=rowWindow({count:items.length,columns:layout.columns,rowHeight:layout.rowHeight,offset:top-rect.top-layout.paddingTop,viewport:viewportHeight(viewport),overscan:2}).indices;return warmWindow?.(warmId,ahead.map(index=>items[index]));},[items,indices,layout,warmWindow,warmId]);
 const focusedPreview=useStableEvent((item,id,index)=>preview?.(item,id,{items:snapshot.current.items,index,columns:snapshot.current.layout.columns||1,kind:'grid'}));
 const pointedPreview=useStableEvent((item,event,id)=>pointerPreview?.(item,event,id,{items:snapshot.current.items,index:virtualCardIndex(event.currentTarget),columns:snapshot.current.layout.columns||1,kind:'grid'}));
 // Ola 3-F(a): a refresh driven by the scene's scroll publishes in a transition, after the key's frame.
 const refresh=defer=>{
  const element=grid.current;if(!element)return;const {items,layout}=snapshot.current;
  const viewport=scrollViewport(element),rect=element.getBoundingClientRect(),top=viewport===window?0:viewport.getBoundingClientRect().top,height=viewportHeight(viewport);
  // R5.1: a different column count or row height invalidates the rows kept by the hysteresis.
  const previous=win.current?.columns===layout.columns&&win.current.rowHeight===layout.rowHeight?win.current:null;
  const next=rowWindow({count:items.length,columns:layout.columns,rowHeight:layout.rowHeight,offset:top-rect.top-layout.paddingTop,viewport:height,overscan:tv?1:2,focusedIndex:focused.current,previous});
  if(defer===true)startTransition(()=>commit(next));else commit(next);
 };
 const placeHalo=index=>{const node=halo.current,{layout}=snapshot.current,at=node&&haloPlacement({index,kind:'grid',width:layout.width,gap:layout.gap,columns:layout.columns,rowHeight:layout.rowHeight,paddingLeft:layout.paddingLeft,paddingTop:layout.paddingTop});if(!at)return;const key=`${at.x},${at.y}`;if(haloAt.current===key)return;haloAt.current=key;liftHalo(node,haloFrames(at,motion.current.scale),motion.current.duration);};
 // R5.5: state only on a real change (one scrollTo per glide → one refresh → usually nothing to commit).
 const commit=next=>{const {items,layout}=snapshot.current;win.current={...next,columns:layout.columns,rowHeight:layout.rowHeight};const pinned=pinWindowFocus(next.indices,focused.current,items.length);if(sameIndices(shown.current,pinned))return;shown.current=pinned;setIndices(pinned);};
 useLayoutEffect(()=>{
  const element=grid.current;let frame,lastWidth=-1;
  const measure=()=>{
   const style=getComputedStyle(element),paddingLeft=parseFloat(style.paddingLeft)||0,paddingRight=parseFloat(style.paddingRight)||0,gap=parseFloat(style.columnGap)||0;
   probe.current.style.left=`${paddingLeft}px`;probe.current.style.right=`${paddingRight}px`;
   const tracks=getComputedStyle(probe.current).gridTemplateColumns.split(/\s+/).filter(Boolean);let columns=Math.max(1,tracks.length);
   if(tv&&!live){
    // Fit the complete selected card, focus scale included, in the list viewport
    // below the fixed banner, from window height only, so nothing reflows columns
    // beneath a held remote key.
    const caption=82;// fixed TV caption height (virtualCatalogue.css)
    const cardHeight=Math.max(180,(window.innerHeight*.52-100-32)/1.08),maxWidth=Math.max(95,(cardHeight-caption)/1.5);
    columns=Math.max(columns,Math.ceil((element.clientWidth-paddingLeft-paddingRight+gap)/(maxWidth+gap)));
   }
   const width=(element.clientWidth-paddingLeft-paddingRight-gap*(columns-1))/columns;motion.current=haloMotion(style);
   setLayout(previous=>({...previous,columns,width,gap,rowGap:parseFloat(style.rowGap)||0,paddingLeft,paddingTop:parseFloat(style.paddingTop)||0,paddingBottom:parseFloat(style.paddingBottom)||0,scene:tv?viewportHeight(scrollViewport(element)):0}));
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
  measure();const observer=new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width===lastWidth)return;lastWidth=width;schedule();});observer.observe(element);window.addEventListener('resize',schedule,{passive:true});
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',schedule);};
 },[live,tv]);
 // Row height follows the first mounted card, re-targeted only when it unmounts.
 useLayoutEffect(()=>{
  const sync=height=>setLayout(previous=>{const rowHeight=height+(previous.rowGap||0);return Math.abs(rowHeight-previous.rowHeight)>1||Math.abs((previous.openHeight||0)-state.openHeight)>1?{...previous,rowHeight,openHeight:state.openHeight}:previous;});
  const state=heights.current||(heights.current={openHeight:0,observer:new ResizeObserver(entries=>{const card=entries[entries.length-1].target,height=card.offsetHeight;state.openHeight=card.querySelector('.card-open')?.offsetHeight||0;if(height>0){state.height=height;sync(height);}})});
  if(state.height&&Math.abs(state.height+(layout.rowGap||0)-layout.rowHeight)>1)sync(state.height);
  if(state.card?.isConnected)return;const card=grid.current.querySelector('.virtual-grid-cell .card');if(!card)return;state.observer.disconnect();state.observer.observe(card);state.card=card;
 });
 useEffect(()=>()=>{heights.current?.observer.disconnect();heights.current=null;},[]);
 useLayoutEffect(refresh,[layout,items]);
 useLayoutEffect(()=>{
  if(lastItems.current===items)return;lastItems.current=items;
  if(focused.current<0)return;
  const retained=items.findIndex(item=>item.id===focusedId.current),next=retained>=0?retained:Math.min(focused.current,items.length-1);
  if(next>=0){const frame=requestAnimationFrame(()=>controller.current?.focus(next));return()=>cancelAnimationFrame(frame);}else{focused.current=-1;focusedId.current=null;grid.current.closest('.app')?.querySelector('.topbar nav button.active')?.focus();}
 },[items]);
 useEffect(()=>{
  const element=grid.current,viewport=scrollViewport(element);let revealed;
  const schedule=()=>{if(pending.current)return;pending.current=requestAnimationFrame(()=>{pending.current=null;refresh(true);});};
  viewport.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true});
  const focus=event=>{const next=virtualCardIndex(event.target);if(next>=0){focused.current=next;focusedId.current=snapshot.current.items[next]?.id;if(tv)placeHalo(next);}};element.addEventListener('focusin',focus);
  const point=event=>{const next=virtualCardIndex(event.target);if(next>=0)placeHalo(next);};if(tv)element.addEventListener('pointerover',point);
  // Removing a filtered item reports relatedTarget=null. Keep its index until
  // the filter effect restores a replacement; a real focus destination clears it.
  const blur=event=>{if(event.relatedTarget&&!element.contains(event.relatedTarget)){focused.current=-1;haloAt.current=null;schedule();}};element.addEventListener('focusout',blur);
  const focusIndex=index=>{
   const {items,layout}=snapshot.current;if(index<0||index>=items.length)return null;focused.current=index;
   const targetRow=Math.floor(index/layout.columns);
   // Only crossings commit synchronously. Ordinary keys focus an existing node.
   let button=element.querySelector(`[data-virtual-index="${index}"] .card-open`);
   if(!button){
    // Ola 3-F(a): a crossing mounts only the target cell synchronously; the new window follows in a transition.
    const next=rowWindow({count:items.length,columns:layout.columns,rowHeight:layout.rowHeight,offset:targetRow*layout.rowHeight,viewport:viewportHeight(viewport),overscan:tv?1:2,focusedIndex:index});
    flushSync(()=>{const pinned=pinWindowFocus(shown.current,index,items.length);shown.current=pinned;setIndices(pinned);});button=element.querySelector(`[data-virtual-index="${index}"] .card-open`);
    startTransition(()=>commit(next));
   }
   // Read stable geometry before focus changes the Card's style. Horizontal
   // repeats in the same visible row need no layout reads or scroll commands.
   if(!revealed||revealed.row!==targetRow||revealed.layout!==layout||(revealed.offset!==viewportOffset(viewport)&&!viewportIsGliding(viewport))||!element.contains(document.activeElement)){
    revealGridIndex(element,layout,index,viewport);revealed={row:targetRow,layout,offset:viewportOffset(viewport)};
   }
   revealRowFor(element);button?.focus({preventScroll:true});return button;
  };
  controller.current={kind:'grid',focus:focusIndex,navigate(key,current){const {items,layout}=snapshot.current,index=virtualCardIndex(current),next=nextGridIndex(index,key,layout.columns,items.length);if(next===null)return null;return focusIndex(next);}};
  const unregister=registerVirtualNavigation(element,controller.current);
  refresh();
  if(focused.current>=0&&element.contains(document.activeElement))focusIndex(focused.current);
  return()=>{unregister();cancelViewportGlide(viewport);cancelAnimationFrame(pending.current);pending.current=null;viewport.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);element.removeEventListener('focusin',focus);element.removeEventListener('focusout',blur);element.removeEventListener('pointerover',point);};
 },[tv]);
 // Ola 3-F row halo: follows the focused index after any render (layout change, filtered items) without reads.
 useLayoutEffect(()=>{if(tv&&focused.current>=0)placeHalo(focused.current);});
 // R5.3: cells keyed by slot (assignSlots over item ids): a row leaving the window lends its nodes to the row that
 // enters; instanceId stays per item. TV paints in slot order (no DOM moves); PC keeps index order for Tab.
 const cells=pinWindowFocus(indices,focused.current,items.length).filter(index=>index<items.length);
 slots.current=assignSlots(slots.current,cells.map(index=>items[index].id),!(tv&&cellsShifted(grid.current)));
 if(tv)cells.sort((a,b)=>slots.current.get(items[a].id)-slots.current.get(items[b].id));
  // TV aligns the focused row to the scene top: leave room for the last row to get there too.
 const height=Math.ceil(items.length/layout.columns)*layout.rowHeight-(items.length?(layout.rowGap||0):0)+layout.paddingTop+layout.paddingBottom+(layout.scene?Math.max(0,layout.scene-layout.rowHeight-24):0);
 return <div ref={grid} className={`catalog-grid virtual-catalogue ${live?'live-grid':'poster-grid'}`} data-virtual-kind="grid" data-virtual-count={items.length} data-virtual-columns={layout.columns} style={{height}}>
  <div ref={probe} className="virtual-layout-probe" aria-hidden="true"/>
  {cells.map(index=>{const item=items[index];return <div key={`s${slots.current.get(item.id)}`} className="virtual-grid-cell" data-virtual-index={index} style={{width:layout.width,left:layout.paddingLeft+(index%layout.columns)*(layout.width+layout.gap),top:layout.paddingTop+Math.floor(index/layout.columns)*layout.rowHeight}}>
   <Card instanceId={`${instancePrefix}:${item.id}`} item={item} metadata={metadata?.[item.id]} metadataPending={resolvedMetadata?!resolvedMetadata.has(item.id):false} open={open} progress={history[item.id]} favorite={favoriteIds.has(item.id)} toggle={toggle} index={index} total={items.length} preview={focusedPreview} pointerPreview={pointedPreview} leave={leave} tv={tv} profileId={profileId} kids={kids}/>
  </div>;})}
  {tv&&cells.length>0&&<i ref={haloRef} className="rail-halo" aria-hidden="true" style={{width:layout.width,height:layout.openHeight||layout.width*1.5}}/>}
 </div>;
});
