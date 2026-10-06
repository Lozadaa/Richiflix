import {useCallback,useEffect,useRef,useState} from 'react';
import {createBannerFlow} from './bannerFlow.js';

// The catalogue viewport keeps its geometry. Only the stage's opacity and
// transform change, so selection never measures layout or changes scrollTop.
export function useBannerMotion(enabled,mainRef,pageKey){
 const [state,setState]=useState({collapsed:true,moving:false}),flow=useRef();
 if(!flow.current)flow.current=createBannerFlow({onChange:setState});
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
 return {collapsed:enabled&&state.collapsed,moving:enabled&&state.moving,select,keep,reset,show};
}
