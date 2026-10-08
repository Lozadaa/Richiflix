import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {shiftViewportFrame} from './virtualViewport.js';

// A catalogue selection can settle hundreds of times without reopening the recommendation banner.
// Only crossing back into the header/banner reveals it; dialogs preserve the previous zone.
export function useTVBannerVisibility(enabled){
 const [visible,setVisible]=useState(true),shown=useRef(true);
 useEffect(()=>{
  if(!enabled)return;
  const show=value=>{if(shown.current===value)return;shown.current=value;setVisible(value);};
  const zone=target=>{
   if(!target?.closest||target.closest('[role="dialog"],.toast'))return;
   if(target.closest('.topbar,.focus-stage'))show(true);
   else if(target.closest('.page-scene,.card-expansion'))show(false);
  };
  // Layout changes can emit pointerover under a stationary mouse. Only an actual pointer move owns the zone.
  let point;
  const focus=event=>zone(event.target),pointer=event=>{if(event.pointerType==='touch'||point&&point.x===event.clientX&&point.y===event.clientY)return;point={x:event.clientX,y:event.clientY};zone(event.target);};
  const wheel=event=>{if(event.target.closest?.('.page-scene'))show(false);};
  zone(document.activeElement);
  window.addEventListener('focusin',focus);window.addEventListener('pointermove',pointer,{passive:true});window.addEventListener('wheel',wheel,{passive:true});window.addEventListener('touchmove',wheel,{passive:true});
  return()=>{window.removeEventListener('focusin',focus);window.removeEventListener('pointermove',pointer);window.removeEventListener('wheel',wheel);window.removeEventListener('touchmove',wheel);};
 },[enabled]);
 return !enabled||visible;
}

// The viewport resizes once at a zone boundary. Compensate its jump on the content's existing compositor
// animation, shared with vertical navigation, instead of transitioning top/height and laying out every frame.
export function useTVBannerLayout(mainRef,enabled,visible){
 const previous=useRef();
 useLayoutEffect(()=>{
  const main=mainRef.current,last=previous.current;previous.current={main,enabled,visible};
  if(!enabled||!last?.enabled||last.main!==main||last.visible===visible)return;
  shiftViewportFrame(main,(visible?-1:1)*window.innerHeight*.42);
  window.dispatchEvent(new Event('richiflix-preview-layout'));
 },[mainRef,enabled,visible]);
}
