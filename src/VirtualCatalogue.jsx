import {useStableEvent} from './useStableEvent.js';
import React,{memo,useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {Card} from './interactions.jsx';
import {nextGridIndex,rowWindow,sameIndices} from './virtualWindow.js';
import {registerVirtualNavigation,virtualCardIndex} from './virtualNavigation.js';
import {revealGridIndex,scrollViewport,viewportHeight,viewportOffset,viewportIsGliding,cancelViewportGlide} from './virtualViewport.js';
import './virtualCatalogue.css';

const initialLayout={columns:7,width:210,rowHeight:420,gap:30,paddingTop:20,paddingBottom:28,paddingLeft:12};
// Keep catalogue objects and callbacks stable; the window is independent of banner state.
export const VirtualCatalogue=memo(function VirtualCatalogue({items,metadata,open,history,favorites,toggle,preview,pointerPreview,leave,tv,warmWindow,resolvedMetadata,instancePrefix='grid'}){
 const warmId=useId();
 const grid=useRef(),probe=useRef(),focused=useRef(-1),focusedId=useRef(),pending=useRef(),snapshot=useRef(),controller=useRef(),lastItems=useRef(items);
 const [layout,setLayout]=useState(initialLayout),[indices,setIndices]=useState(()=>rowWindow({count:items.length,columns:7,rowHeight:420,viewport:600}).indices);
 const live=useMemo(()=>items.length>0&&items.every(item=>item.kind==='iptv'),[items]),favoriteIds=useMemo(()=>new Set(favorites),[favorites]);
 snapshot.current={items,layout};
 useEffect(()=>{const viewport=scrollViewport(grid.current),rect=grid.current.getBoundingClientRect(),top=viewport===window?0:viewport.getBoundingClientRect().top;const ahead=rowWindow({count:items.length,columns:layout.columns,rowHeight:layout.rowHeight,offset:top-rect.top-layout.paddingTop,viewport:viewportHeight(viewport),overscan:2}).indices;return warmWindow?.(warmId,ahead.map(index=>items[index]));},[items,indices,layout,warmWindow,warmId]);
 const focusedPreview=useStableEvent((item,id,index)=>preview?.(item,id,{items:snapshot.current.items,index,columns:snapshot.current.layout.columns||1,kind:'grid'}));
 const pointedPreview=useStableEvent((item,event,id)=>pointerPreview?.(item,event,id,{items:snapshot.current.items,index:virtualCardIndex(event.currentTarget),columns:snapshot.current.layout.columns||1,kind:'grid'}));
 const refresh=()=>{
  const element=grid.current;if(!element)return;const {items,layout}=snapshot.current;
  const viewport=scrollViewport(element),rect=element.getBoundingClientRect(),top=viewport===window?0:viewport.getBoundingClientRect().top,height=viewportHeight(viewport);
  const next=rowWindow({count:items.length,columns:layout.columns,rowHeight:layout.rowHeight,offset:top-rect.top-layout.paddingTop,viewport:height,overscan:tv?1:2,focusedIndex:focused.current}).indices;
  setIndices(previous=>sameIndices(previous,next)?previous:next);
 };
 useLayoutEffect(()=>{
  const element=grid.current;let frame,lastWidth=-1;
  const measure=()=>{
   const style=getComputedStyle(element),paddingLeft=parseFloat(style.paddingLeft)||0,paddingRight=parseFloat(style.paddingRight)||0,gap=parseFloat(style.columnGap)||0;
   probe.current.style.left=`${paddingLeft}px`;probe.current.style.right=`${paddingRight}px`;
   const tracks=getComputedStyle(probe.current).gridTemplateColumns.split(/\s+/).filter(Boolean);let columns=Math.max(1,tracks.length);
   if(tv&&!live){
    // Fit the complete selected card, including the 1.08 focus scale, in the
    // expanded banner's viewport. Use the expanded height even while collapsed,
    // so banner animation cannot reflow columns beneath a held remote key.
    const caption=document.documentElement.classList.contains('samsung-tv')?80:76;
    const cardHeight=Math.max(180,(window.innerHeight*.52-100-32)/1.08),maxWidth=Math.max(95,(cardHeight-caption)/1.5);
    columns=Math.max(columns,Math.ceil((element.clientWidth-paddingLeft-paddingRight+gap)/(maxWidth+gap)));
   }
   const width=(element.clientWidth-paddingLeft-paddingRight-gap*(columns-1))/columns;
   setLayout(previous=>({...previous,columns,width,gap,rowGap:parseFloat(style.rowGap)||0,paddingLeft,paddingTop:parseFloat(style.paddingTop)||0,paddingBottom:parseFloat(style.paddingBottom)||0}));
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
  measure();const observer=new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width===lastWidth)return;lastWidth=width;schedule();});observer.observe(element);window.addEventListener('resize',schedule,{passive:true});
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',schedule);};
 },[live,tv]);
 useLayoutEffect(()=>{
  const card=grid.current.querySelector('.card');if(!card)return;
  const rowHeight=card.offsetHeight+(layout.rowGap||0);if(rowHeight>0&&Math.abs(rowHeight-layout.rowHeight)>1)setLayout(previous=>({...previous,rowHeight}));
 },[layout.width,layout.rowGap,live,tv]);
 useLayoutEffect(refresh,[layout,items]);
 useLayoutEffect(()=>{
  if(lastItems.current===items)return;lastItems.current=items;
  if(focused.current<0)return;
  const retained=items.findIndex(item=>item.id===focusedId.current),next=retained>=0?retained:Math.min(focused.current,items.length-1);
  if(next>=0){const frame=requestAnimationFrame(()=>controller.current?.focus(next));return()=>cancelAnimationFrame(frame);}else{focused.current=-1;focusedId.current=null;grid.current.closest('.app')?.querySelector('.topbar nav button.active')?.focus();}
 },[items]);
 useEffect(()=>{
  const element=grid.current,viewport=scrollViewport(element);let revealed;
  const schedule=()=>{if(pending.current)return;pending.current=requestAnimationFrame(()=>{pending.current=null;refresh();});};
  viewport.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true});
  const focus=event=>{const next=virtualCardIndex(event.target);if(next>=0){focused.current=next;focusedId.current=snapshot.current.items[next]?.id;}};element.addEventListener('focusin',focus);
  // Removing a filtered item reports relatedTarget=null. Keep its index until
  // the filter effect restores a replacement; a real focus destination clears it.
  const blur=event=>{if(event.relatedTarget&&!element.contains(event.relatedTarget)){focused.current=-1;schedule();}};element.addEventListener('focusout',blur);
  const focusIndex=index=>{
   const {items,layout}=snapshot.current;if(index<0||index>=items.length)return null;focused.current=index;
   const targetRow=Math.floor(index/layout.columns);
   // Only crossings commit synchronously. Ordinary keys focus an existing node.
   let button=element.querySelector(`[data-virtual-index="${index}"] .card-open`);
   if(!button){
    const next=rowWindow({count:items.length,columns:layout.columns,rowHeight:layout.rowHeight,offset:targetRow*layout.rowHeight,viewport:viewportHeight(viewport),overscan:tv?1:2,focusedIndex:index}).indices;
    flushSync(()=>setIndices(next));button=element.querySelector(`[data-virtual-index="${index}"] .card-open`);
   }
   // Read stable geometry before focus changes the Card's style. Horizontal
   // repeats in the same visible row need no layout reads or scroll commands.
   if(!revealed||revealed.row!==targetRow||revealed.layout!==layout||(revealed.offset!==viewportOffset(viewport)&&!viewportIsGliding(viewport))||!element.contains(document.activeElement)){
    revealGridIndex(element,layout,index,viewport);revealed={row:targetRow,layout,offset:viewportOffset(viewport)};
   }
   button?.focus({preventScroll:true});return button;
  };
  controller.current={kind:'grid',focus:focusIndex,navigate(key,current){const {items,layout}=snapshot.current,index=virtualCardIndex(current),next=nextGridIndex(index,key,layout.columns,items.length);if(next===null)return null;return focusIndex(next);}};
  const unregister=registerVirtualNavigation(element,controller.current);
  refresh();
  if(focused.current>=0&&element.contains(document.activeElement))focusIndex(focused.current);
  return()=>{unregister();cancelViewportGlide(viewport);cancelAnimationFrame(pending.current);pending.current=null;viewport.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);element.removeEventListener('focusin',focus);element.removeEventListener('focusout',blur);};
 },[tv]);
 const height=Math.ceil(items.length/layout.columns)*layout.rowHeight-(items.length?(layout.rowGap||0):0)+layout.paddingTop+layout.paddingBottom;
 return <div ref={grid} className={`catalog-grid virtual-catalogue ${live?'live-grid':'poster-grid'}`} data-virtual-kind="grid" data-virtual-count={items.length} data-virtual-columns={layout.columns} style={{height}}>
  <div ref={probe} className="virtual-layout-probe" aria-hidden="true"/>
  {indices.filter(index=>index<items.length).map(index=>{const item=items[index];return <div key={item.id} className="virtual-grid-cell" data-virtual-index={index} style={{width:layout.width,left:layout.paddingLeft+(index%layout.columns)*(layout.width+layout.gap),top:layout.paddingTop+Math.floor(index/layout.columns)*layout.rowHeight}}>
   <Card instanceId={`${instancePrefix}:${item.id}`} item={item} metadata={metadata?.[item.id]} metadataPending={resolvedMetadata?!resolvedMetadata.has(item.id):false} open={open} progress={history[item.id]} favorite={favoriteIds.has(item.id)} toggle={toggle} index={index} preview={focusedPreview} pointerPreview={pointedPreview} leave={leave} tv={tv}/>
  </div>;})}
 </div>;
});
