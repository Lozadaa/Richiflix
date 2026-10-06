import {useEffect,useRef,useState} from 'react';
import {expandedCardPlacement,createCardPress} from './cardExpansion.js';
import {useStableEvent} from './useStableEvent.js';
import {reserveCardExpansion} from './cardExpansionSpace.js';

export function useCardExpansion(anchor,selected,instanceId,tv,onOpen,live=false){
 const [placement,setPlacement]=useState(null),surface=useRef(),latest=useRef(),press=useRef();
 latest.current={placement,onOpen};
 const owned=useStableEvent(node=>Boolean(node&&(anchor.current?.contains(node)||surface.current?.contains(node))));
 const restore=useStableEvent(()=>anchor.current?.querySelector('.card-open')?.focus({preventScroll:true}));
 const actions=useStableEvent(()=>surface.current?.querySelector('.expansion-actions button')?.focus({preventScroll:true}));
 if(!press.current)press.current=createCardPress({short:()=>latest.current.onOpen(),long:actions});
 useEffect(()=>{
  if(!selected){setPlacement(null);return;}
  let timer,space,ignoreScrollUntil=0,pointer=anchor.current?.matches(':hover')||false;
  const hide=()=>{clearTimeout(timer);timer=undefined;press.current.cancel();space?.cleanup();space=undefined;setPlacement(null);};
  const show=()=>{
   timer=undefined;if(!anchor.current?.isConnected||document.hidden||document.querySelector('[role="dialog"]')||(!pointer&&!owned(document.activeElement)))return;
   space?.cleanup();space=undefined;
   const cell=anchor.current.closest('.virtual-rail-cell,.virtual-grid-cell')||anchor.current,box=cell.getBoundingClientRect(),main=anchor.current.closest('main'),bounds=main?.getBoundingClientRect(),rail=Boolean(anchor.current.closest('[data-virtual-kind="rail"]'));
   const viewport={left:0,top:Math.max(0,bounds?.top||0),width:window.innerWidth,height:Math.min(window.innerHeight,bounds?.bottom||window.innerHeight)-Math.max(0,bounds?.top||0)};
   const panel=expandedCardPlacement(box,viewport,{tv,live,alignStart:rail});if(!panel)return;
   ignoreScrollUntil=performance.now()+80;space=reserveCardExpansion(anchor.current,box,panel);
   setPlacement(space.moved?expandedCardPlacement(cell.getBoundingClientRect(),viewport,{tv,live,alignStart:rail}):panel);
  };
  const queue=()=>{if(!timer)timer=setTimeout(show,250);};
  const focus=event=>{if(owned(event.target)){if(!latest.current.placement)queue();}else hide();};
  const move=event=>{pointer=owned(event.target);if(pointer){if(!latest.current.placement)queue();}else if(!owned(document.activeElement))hide();};
  const scroll=()=>{if(performance.now()<ignoreScrollUntil)return;hide();if(owned(document.activeElement)||pointer)queue();};
  const navigating=()=>hide();
  queue();window.addEventListener('focusin',focus);window.addEventListener('pointermove',move,{passive:true});window.addEventListener('scroll',scroll,true);window.addEventListener('resize',scroll);window.addEventListener('richiflix-catalog-navigation',navigating);document.addEventListener('visibilitychange',hide);
  return()=>{clearTimeout(timer);space?.cleanup();press.current.cancel();window.removeEventListener('focusin',focus);window.removeEventListener('pointermove',move);window.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',scroll);window.removeEventListener('richiflix-catalog-navigation',navigating);document.removeEventListener('visibilitychange',hide);};
 },[selected,anchor,instanceId,tv,owned,live]);
 const keyDown=event=>{
  if(event.key==='Tab'&&!event.shiftKey&&placement&&event.target.matches('.card-open')){event.preventDefault();actions();return;}
  if(tv&&placement&&selected&&(event.key==='Enter'||event.keyCode===13)&&event.target.matches('.card-open')){event.preventDefault();event.stopPropagation();press.current.down();}
  else if(event.key.startsWith('Arrow'))press.current.cancel();
 };
 const keyUp=event=>{if((event.key==='Enter'||event.keyCode===13)&&press.current.pressed){event.preventDefault();event.stopPropagation();press.current.up();}};
 return {placement,surface,restore,keyDown,keyUp};
}
