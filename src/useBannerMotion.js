import {useCallback,useEffect,useRef,useState} from 'react';
import {createBannerFlow,createBannerCarousel} from './bannerFlow.js';

// The catalogue viewport keeps its geometry: selection never measures layout or
// changes scrollTop. `moving` only defers work during a burst of remote keys.
// R1.5: the start of a burst renders nothing (no class on .app either: it invalidated the whole page right before focus()); React
// state is published only when the burst ends (settle, keep, reset). `moving`/`collapsed` are read live from
// the flow, so any render inside the burst (the selection's own) already sees moving=true.
export function useBannerMotion(enabled,mainRef,pageKey){
 const [,setState]=useState(null),flow=useRef();
 if(!flow.current)flow.current=createBannerFlow({onChange:state=>{if(!state.moving)setState(state);}});
 const select=useCallback(commit=>flow.current.select(commit),[]);
 const keep=useCallback(commit=>flow.current.keep(commit),[]);
 const reset=useCallback(()=>flow.current.reset(),[]);
 const show=useCallback(()=>flow.current.keep(()=>true),[]);
 useEffect(()=>{
  const controller=flow.current;controller.reset();if(!enabled)return;
  const main=mainRef.current;
  const begin=()=>controller.move();
  const scroll=()=>{if(controller.state.moving)controller.move();};
  const drag=event=>{if(event.target===main)begin();};
  const focus=event=>{if(event.target.closest('.topbar'))controller.keep(()=>true);else if(!event.target.closest('.card,.card-expansion,.focus-stage'))controller.reset();};
  const visibility=()=>{if(document.hidden)controller.reset();};
  main?.addEventListener('wheel',begin,{passive:true});
  main?.addEventListener('touchmove',begin,{passive:true});
  main?.addEventListener('scroll',scroll,{passive:true});
  main?.addEventListener('pointerdown',drag);
  window.addEventListener('richiflix-catalog-navigation',begin);
  window.addEventListener('focusin',focus);
  document.addEventListener('visibilitychange',visibility);
  return()=>{
   controller.reset();main?.removeEventListener('wheel',begin);main?.removeEventListener('touchmove',begin);main?.removeEventListener('scroll',scroll);main?.removeEventListener('pointerdown',drag);
   window.removeEventListener('richiflix-catalog-navigation',begin);window.removeEventListener('focusin',focus);document.removeEventListener('visibilitychange',visibility);
  };
 },[enabled,mainRef,pageKey]);
 useEffect(()=>()=>flow.current.reset(),[]);
 const state=flow.current.state;
 return {collapsed:enabled&&state.collapsed,moving:enabled&&state.moving,select,keep,reset,show};
}

// Fase C2: the TV banner is its own recommendation carousel. The shown slide
// is tracked by id, so a refreshed list keeps it instead of jumping.
export function useBannerCarousel(ids,paused,ready){
 const [,setIndex]=useState(0),[hidden,setHidden]=useState(()=>document.hidden),latest=useRef(),shown=useRef(null),carousel=useRef();latest.current={ids,ready};
 if(!carousel.current)carousel.current=createBannerCarousel({onChange:value=>{shown.current=latest.current.ids[value]??null;setIndex(value);},ready:next=>latest.current.ready(next)});
 const key=ids.join('\n');
 useEffect(()=>{carousel.current.reset(ids.length,Math.max(0,ids.indexOf(shown.current)));},[key]);
 useEffect(()=>{const sync=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',sync);return()=>document.removeEventListener('visibilitychange',sync);},[]);
 useEffect(()=>{const controller=carousel.current;if(paused||hidden)controller.pause();else controller.resume();return()=>controller.pause();},[paused,hidden]);
 const go=useCallback(index=>carousel.current.go(index),[]);
 return {index:Math.max(0,ids.indexOf(shown.current)),go};
}
