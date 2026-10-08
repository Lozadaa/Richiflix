import {useEffect,useState} from 'react';

// Playback stays clear until mouse, touch or keyboard activity wakes controls.
export function usePlaybackChrome(enabled,tvMode=false){
 const [hidden,setHidden]=useState(false);
 useEffect(()=>{
  setHidden(false);
  if(!enabled)return;
  let timer,keyboard=false;
  const arm=()=>{
   clearTimeout(timer);
   timer=setTimeout(()=>{
    const active=document.activeElement;
    const chrome=document.querySelector('.player-heading:hover,.back-button:hover,.player-controls:hover');
    if(!tvMode&&(chrome||(keyboard&&active?.closest('.player-heading,.back-button,.player-controls')))){arm();return;}
    if(active?.closest('.player-heading,.back-button,.player-controls'))document.querySelector('.player-dialog video')?.focus({preventScroll:true});
    setHidden(true);
   },2800);
  };
  const wake=e=>{
   if(e.type==='keydown')keyboard=true;
   else if(e.type.startsWith('pointer'))keyboard=false;
   setHidden(false);arm();
  };
  const events=['pointermove','pointerdown','keydown','focusin'];
  events.forEach(event=>window.addEventListener(event,wake,{passive:true,capture:event==='keydown'}));arm();
  return()=>{clearTimeout(timer);events.forEach(event=>window.removeEventListener(event,wake,event==='keydown'));};
 },[enabled,tvMode]);
 return enabled&&hidden;
}
