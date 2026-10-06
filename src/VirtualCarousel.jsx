import {useStableEvent} from './useStableEvent.js';
import React,{memo,useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {Card,motionAllowed} from './interactions.jsx';
import {displayText} from './displayText.js';
import {railWindow,sameIndices} from './virtualWindow.js';
import {registerVirtualNavigation,virtualCardIndex} from './virtualNavigation.js';
import {revealRailCard,scrollViewport,viewportOffset,viewportIsGliding,cancelViewportGlide} from './virtualViewport.js';
import './virtualCatalogue.css';

export const VirtualCarousel=memo(function VirtualCarousel({title,items,metadata,open,history,favorites,toggle,more,preview,pointerPreview,leave,tv,warmWindow,resolvedMetadata}){
 const rail=useRef(),probe=useRef(),progress=useRef(),focused=useRef(-1),snapshot=useRef(),pending=useRef(),nearRef=useRef(true),id=useId();
 const live=useMemo(()=>items.length>0&&items.every(item=>item.kind==='iptv'),[items]),favoriteIds=useMemo(()=>new Set(favorites),[favorites]);
 const [layout,setLayout]=useState({width:tv?210:190,gap:tv?30:16,height:420,viewportWidth:1920,paddingLeft:0,paddingRight:0}),[indices,setIndices]=useState(()=>railWindow({count:items.length,itemWidth:210,gap:30,viewport:1920}).indices),[position,setPosition]=useState({start:true,end:items.length<2});
 const [warmNear,setWarmNear]=useState(true);
 const [near,setNear]=useState(true),[pin,setPin]=useState(-1);
 snapshot.current={items,layout};
 useEffect(()=>{const element=rail.current,viewport=scrollViewport(element),margin=2*(layout.height+90),observer=new IntersectionObserver(entries=>setWarmNear(entries[0].isIntersecting),{root:viewport===window?null:viewport,rootMargin:`280px 0px ${margin}px 0px`,threshold:0});observer.observe(element);return()=>observer.disconnect();},[layout.height,tv]);
 useEffect(()=>warmWindow?.(id,warmNear?indices.map(index=>items[index]):[]),[items,indices,warmNear,warmWindow,id]);
 const focusedPreview=useStableEvent((item,id,index)=>preview?.(item,id,{items:snapshot.current.items,index,columns:snapshot.current.layout.columns||1,kind:'rail'}));
 const pointedPreview=useStableEvent((item,event,id)=>pointerPreview?.(item,event,id,{items:snapshot.current.items,index:virtualCardIndex(event.currentTarget),columns:snapshot.current.layout.columns||1,kind:'rail'}));
 const refresh=()=>{
  const element=rail.current;if(!element)return;const {items,layout}=snapshot.current;
  const offset=element.scrollLeft,viewport=layout.viewportWidth;
  const next=railWindow({count:items.length,itemWidth:layout.width,gap:layout.gap,offset,viewport,focusedIndex:focused.current}).indices;
  setIndices(previous=>sameIndices(previous,next)?previous:next);
  const max=Math.max(0,items.length*(layout.width+layout.gap)-layout.gap+layout.paddingLeft+layout.paddingRight-viewport),start=offset<6,end=max<6||offset>=max-6;
  setPosition(previous=>previous.start===start&&previous.end===end?previous:{start,end});
  if(progress.current)progress.current.style.transform=`translateX(${max>0?offset/max*200:0}%)`;
 };
 useLayoutEffect(()=>{
  const element=rail.current;let frame,lastWidth=-1;
  const measure=()=>{
   const style=getComputedStyle(probe.current),basis=style.flexBasis;probe.current.style.width=basis==='auto'?'210px':basis;
   const width=probe.current.offsetWidth,railStyle=getComputedStyle(element),gap=parseFloat(railStyle.columnGap)||0,viewportWidth=element.clientWidth,paddingLeft=parseFloat(railStyle.paddingLeft)||0,paddingRight=parseFloat(railStyle.paddingRight)||0;
   if(width>0)setLayout(previous=>previous.width===width&&previous.gap===gap&&previous.viewportWidth===viewportWidth&&previous.paddingLeft===paddingLeft&&previous.paddingRight===paddingRight?previous:{...previous,width,gap,viewportWidth,paddingLeft,paddingRight});
  };
  measure();const observer=new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width===lastWidth)return;lastWidth=width;cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);});observer.observe(element);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();};
 },[tv,live]);
 useLayoutEffect(()=>{const card=rail.current.querySelector('.virtual-rail-cell .card');if(card&&card.offsetHeight>0&&Math.abs(layout.height-card.offsetHeight)>1)setLayout(previous=>({...previous,height:card.offsetHeight}));},[layout.width,tv,live]);
 useLayoutEffect(refresh,[layout,items]);
 useLayoutEffect(()=>{
  const element=rail.current,viewport=scrollViewport(element),margin=280;
  const visible=value=>{nearRef.current=value;setNear(value);setPin(value?-1:focused.current);};
  const bounds=element.getBoundingClientRect(),root=viewport===window?{top:0,bottom:window.innerHeight}:viewport.getBoundingClientRect();
  visible(bounds.bottom>=root.top-margin&&bounds.top<=root.bottom+margin);
  const observer=new IntersectionObserver(entries=>visible(entries[0].isIntersecting),{root:viewport===window?null:viewport,rootMargin:`${margin}px 0px`,threshold:0});observer.observe(element);
  return()=>observer.disconnect();
 },[tv]);
 useEffect(()=>{
  const element=rail.current,viewport=scrollViewport(element);let revealed;
  const schedule=()=>{if(pending.current)return;pending.current=requestAnimationFrame(()=>{pending.current=null;refresh();});};
  const focus=event=>{const index=virtualCardIndex(event.target);if(index>=0){focused.current=index;if(!nearRef.current)setPin(index);}};
  const blur=event=>{if(event.relatedTarget&&!element.contains(event.relatedTarget)){focused.current=-1;setPin(-1);schedule();}};
  element.addEventListener('scroll',schedule,{passive:true});element.addEventListener('focusin',focus);element.addEventListener('focusout',blur);
  const focusIndex=index=>{
   const {items,layout}=snapshot.current;if(index<0||index>=items.length)return null;focused.current=index;
   let button=element.querySelector(`[data-virtual-index="${index}"] .card-open`);
   if(!button){flushSync(()=>{nearRef.current=true;setNear(true);setPin(-1);setIndices(railWindow({count:items.length,itemWidth:layout.width,gap:layout.gap,offset:index*(layout.width+layout.gap),viewport:layout.viewportWidth,focusedIndex:index}).indices);});button=element.querySelector(`[data-virtual-index="${index}"] .card-open`);}
   const left=layout.paddingLeft+index*(layout.width+layout.gap),right=left+layout.width,margin=24,offset=element.scrollLeft;
   const next=left<offset+margin?Math.max(0,left-margin):right>offset+layout.viewportWidth-margin?right-layout.viewportWidth+margin:offset;
   if(next!==offset)element.scrollTo({left:next,behavior:'instant'});
   if(!revealed||revealed.layout!==layout||(revealed.offset!==viewportOffset(viewport)&&!viewportIsGliding(viewport))||!element.contains(document.activeElement)){
    revealRailCard(element,index,viewport);revealed={layout,offset:viewportOffset(viewport)};
   }
   button?.focus({preventScroll:true});return button;
  };
  const unregister=registerVirtualNavigation(element,{kind:'rail',focus:focusIndex,navigate(key,current){if(!['ArrowLeft','ArrowRight'].includes(key))return null;return focusIndex(virtualCardIndex(current)+(key==='ArrowRight'?1:-1));}});
  refresh();
  if(focused.current>=0&&element.contains(document.activeElement))focusIndex(focused.current);
  return()=>{unregister();cancelViewportGlide(viewport);cancelAnimationFrame(pending.current);pending.current=null;element.removeEventListener('scroll',schedule);element.removeEventListener('focusin',focus);element.removeEventListener('focusout',blur);};
 },[tv]);
 const move=direction=>rail.current.scrollBy({left:direction*(rail.current.clientWidth+15),behavior:motionAllowed()?'smooth':'instant'});
 return <section className="catalog-row" aria-labelledby={id}>
  <div className="row-heading"><h2 id={id}>{displayText(title)}</h2><div className="row-controls"><button className="rail-arrow" aria-label={`Anterior en ${title}`} disabled={position.start} onClick={()=>move(-1)}><ChevronLeft size={20}/></button><button className="rail-arrow" aria-label={`Siguiente en ${title}`} disabled={position.end} onClick={()=>move(1)}><ChevronRight size={20}/></button></div></div>
  <div className="rail-wrap"><div ref={rail} className="cards virtual-rail" aria-label={displayText(title)} data-virtual-kind="rail" data-virtual-count={items.length}>
   <div ref={probe} className={`card ${live?'live-card':'portrait-card'} virtual-rail-probe`} aria-hidden="true"/>
   <div className="virtual-rail-track" style={{width:Math.max(0,items.length*(layout.width+layout.gap)-layout.gap),height:layout.height}}>
    {(near?indices:pin>=0?[pin]:[]).filter(index=>index<items.length).map(index=>{const item=items[index];return <div key={item.id} className="virtual-rail-cell" data-virtual-index={index} style={{width:layout.width,left:index*(layout.width+layout.gap)}}><Card instanceId={`${id}:${item.id}`} item={item} metadata={metadata?.[item.id]} metadataPending={resolvedMetadata?!resolvedMetadata.has(item.id):false} open={open} progress={history[item.id]} favorite={favoriteIds.has(item.id)} toggle={toggle} index={index} preview={focusedPreview} pointerPreview={pointedPreview} leave={leave} tv={tv}/></div>;})}
   </div>
  </div>{!position.end&&<span className="rail-edge" aria-hidden="true"/>}</div>
  <div className="row-footer">{more||<span/>}{(!position.start||!position.end)&&<span className="rail-progress" aria-hidden="true"><i ref={progress}/></span>}</div>
 </section>;
});
