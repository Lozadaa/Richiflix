import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {expandedCardPlacement,expansionAlignFor,cellAnchorBox,createCardPress,expansionViewportTop,createExpansionHub,EXPANSION_DELAY_MS} from './cardExpansion.js';
import {useStableEvent} from './useStableEvent.js';
import {reserveCardExpansion} from './cardExpansionSpace.js';
import {viewportIsGliding} from './virtualViewport.js';
import {revealRowFor} from './virtualNavigation.js';

// The TV trailer frame (below the fixed header, inside the fixed-height stage)
// only changes with the viewport or a new stage node, so it is measured once and
// read in show()'s read phase, never inside the panel's mount commit.
let trailerFrame,hub;
// R1.3: one listener set for every card (cardExpansion.js createExpansionHub), created on first use.
const expansionHub=()=>hub||(hub=createExpansionHub());
function stageTrailerFrame(app){
 const stage=app?.querySelector('.focus-stage.hero'),header=app?.querySelector('.topbar');if(!stage||!header||stage.dataset.stageVisible==='false')return null;
 const key=`${window.innerWidth}x${window.innerHeight}`;if(trailerFrame?.key===key&&trailerFrame.stage===stage)return trailerFrame;
 const bottom=header.getBoundingClientRect().bottom;
 return trailerFrame={key,stage,position:{left:0,top:bottom,width:window.innerWidth,height:Math.max(0,stage.offsetHeight-bottom)}};
}
export function useCardExpansion(anchor,selected,instanceId,tv,onOpen,live=false,onLong,tall=false){
 const [placement,setPlacement]=useState(null),surface=useRef(),latest=useRef(),press=useRef();
 const previousPlacement=useRef(),movement=useRef();
 useLayoutEffect(()=>{
  const previous=previousPlacement.current;previousPlacement.current=placement;movement.current?.cancel();
  if(!previous||!placement||!surface.current||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const x=previous.left-placement.left,y=previous.top-placement.top;if(Math.abs(x)+Math.abs(y)<1)return;
  movement.current=surface.current.animate([{transform:`translate3d(${x}px,${y}px,0)`},{transform:'translate3d(0,0,0)'}],{duration:tv?140:220,easing:'cubic-bezier(.22,1,.36,1)'});
 },[placement,tv]);
 useEffect(()=>()=>movement.current?.cancel(),[]);
 latest.current={placement,onOpen,onLong};
 const owned=useStableEvent(node=>Boolean(node&&(anchor.current?.contains(node)||surface.current?.contains(node))));
 const restore=useStableEvent(()=>revealRowFor(anchor.current?.querySelector('.card-open'))?.focus({preventScroll:true}));
 const actions=useStableEvent(()=>surface.current?.querySelector('.expansion-actions button')?.focus({preventScroll:true}));
 if(!press.current)press.current=createCardPress({short:()=>latest.current.onOpen(),long:()=>{latest.current.onLong?.();actions();}});
 useEffect(()=>{
  if(!selected){setPlacement(null);return;}
  const hub=expansionHub();
  let timer,space,ignoreScrollUntil=0,pointer=anchor.current?.matches(':hover')||false,hidePending=false;
  // Navigation hides instantly so the next expansion starts from rest; only a calm pointer exit lets the
  // neighbours glide back. R1.2: a key (navigation, focus leaving) only marks the hide; it runs in the next
  // animation frame (hub.schedule → frame), never inside the keydown.
  const hide=(instant=true)=>{hidePending=false;clearTimeout(timer);timer=undefined;press.current.cancel();movement.current?.cancel();space?.cleanup(instant);space=undefined;setPlacement(null);};
  const requestHide=()=>{clearTimeout(timer);timer=undefined;press.current.cancel();hidePending=true;hub.schedule();};
  const show=()=>{
   timer=undefined;hidePending=false;if(!anchor.current?.isConnected||document.hidden||document.querySelector('[role="dialog"]')||(!pointer&&!owned(document.activeElement)))return;
   // R1.6: a row glide moves the scene content by transform; measure only once it has landed.
   const scene=anchor.current.closest('main');if(scene&&viewportIsGliding(scene)){queue();return;}
   // One batch: reservations retired by a card left behind are cancelled before this one measures and animates.
   hub.flushRetired();space?.cleanup(true);space=undefined;
   const cell=anchor.current.closest('.virtual-rail-cell,.virtual-grid-cell')||anchor.current,box=cellAnchorBox(cell),main=anchor.current.closest('main'),bounds=main?.getBoundingClientRect(),railNode=anchor.current.closest('[data-virtual-kind="rail"]'),rail=Boolean(railNode);
   const heading=rail?anchor.current.closest('.catalog-row')?.querySelector('.row-heading'):null,grid=rail?null:anchor.current.closest('.catalog-grid'),controls=grid?main?.querySelector('.catalog-controls'):null;
   const top=expansionViewportTop({mainTop:bounds?.top||0,boxTop:box.top,headingBottom:heading?.getBoundingClientRect().bottom,gridTop:grid?.getBoundingClientRect().top,controlsBottom:controls?.getBoundingClientRect().bottom});
   const viewport={left:0,top,width:window.innerWidth,height:Math.min(window.innerHeight,bounds?.bottom||window.innerHeight)-top};
   const options={tv,live,tall,align:rail||tv?'start':'center'};let panel=expandedCardPlacement(box,viewport,options);if(!panel)return;
   // Kingdom A3: a TV rail keeps the card at the fixed column, first and last items included, so expansionAlignFor
   // never flips its side (expansionAlignFor tv:true; here TV skips it and its scrollLeft read). Pointer browsing on desktop retains its near-edge placement (F2).
   if(rail&&!tv){options.align=railNode.dataset.expansionAlign=expansionAlignFor({cellLeft:parseFloat(cell.style.left)||0,cellWidth:box.width,scrollLeft:railNode.scrollLeft,viewportWidth:railNode.clientWidth,previous:railNode.dataset.expansionAlign,panelWidth:panel.width});if(options.align==='end')panel=expandedCardPlacement(box,viewport,options);}
   // The rail scroll depends only on the panel width; place once from the model shifted by that scroll.
   ignoreScrollUntil=performance.now()+80;space=reserveCardExpansion(anchor.current,box,panel,tv,options.align);
   const placed=space.scroll?expandedCardPlacement({...box,left:box.left-space.scroll,right:box.right-space.scroll},viewport,options)||panel:panel;
   setPlacement(tv&&!live?{...placed,trailer:stageTrailerFrame(anchor.current.closest('.app'))}:placed);
  };
  const queue=()=>{if(!timer)timer=setTimeout(show,tv?EXPANSION_DELAY_MS:250);};
  const unregister=hub.register({
   focus:event=>{if(owned(event.target)){hidePending=false;if(!latest.current.placement)queue();}else requestHide();},
   move:event=>{pointer=owned(event.target);if(pointer){if(!latest.current.placement)queue();}else if(!owned(document.activeElement))hide(false);},
   scroll:()=>{if(performance.now()<ignoreScrollUntil)return;hide();if(owned(document.activeElement)||pointer)queue();},
   navigate:requestHide,
   reflow:()=>{if(latest.current.placement)show();},
   visibility:()=>hide(),
   frame:()=>{if(hidePending)hide();}
  });
  queue();
  // A card left behind retires its reservation: the hub cancels it in the next frame (or the next opening's batch).
  return()=>{clearTimeout(timer);unregister();hub.retire(space);space=undefined;press.current.cancel();};
 },[selected,anchor,instanceId,tv,owned,live,tall]);
 const keyDown=event=>{
  if(event.key==='Tab'&&!event.shiftKey&&placement&&event.target.matches('.card-open')){event.preventDefault();actions();return;}
  if(tv&&placement&&selected&&(event.key==='Enter'||event.keyCode===13)&&event.target.matches('.card-open')){event.preventDefault();event.stopPropagation();press.current.down();}
  else if(event.key.startsWith('Arrow'))press.current.cancel();
 };
 const keyUp=event=>{if((event.key==='Enter'||event.keyCode===13)&&press.current.pressed){event.preventDefault();event.stopPropagation();press.current.up();}};
 return {placement,surface,restore,keyDown,keyUp};
}
