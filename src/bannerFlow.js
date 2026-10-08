// A single quiet period owns the preview. Movement only changes two booleans;
// intermediate cards never become artwork or video requests.
export function createBannerFlow({onChange=()=>{},onCommit=value=>value?.(),settleMs=480,schedule=setTimeout,cancel=clearTimeout}={}){
 let state={collapsed:true,moving:false},candidate,timer,closed=false;
 const publish=(collapsed,moving)=>{
  if(state.collapsed===collapsed&&state.moving===moving)return;
  state={collapsed,moving};onChange(state);
 };
 const clear=()=>{if(timer!==undefined){cancel(timer);timer=undefined;}};
 const settle=()=>{
  timer=undefined;if(closed)return;
  const selected=candidate;
  if(selected!==undefined&&onCommit(selected)!==false)publish(false,false);
  else publish(true,false);
 };
 const move=()=>{if(closed)return;publish(true,true);clear();timer=schedule(settle,settleMs);};
 return {
  get state(){return state;},
  move,
  select(value){if(closed)return;candidate=value;move();},
  keep(value){if(closed)return;clear();candidate=value;if(onCommit(value)!==false)publish(false,false);else publish(true,false);},
  reset(){if(closed)return;clear();candidate=undefined;publish(true,false);},
  dispose(){closed=true;clear();candidate=undefined;}
 };
}

// The TV banner rotates on its own clock (Fase C2). A pause cancels the tick;
// resuming waits a quiet resumeMs plus a full interval. A slide whose art is
// not decoded yet is skipped and retried on the next tick, never shown half-done.
export function createBannerCarousel({count=0,intervalMs=9000,resumeMs=2000,onChange=()=>{},ready=()=>true,schedule=setTimeout,cancel=clearTimeout}={}){
 let index=0,paused=false,timer;
 const clear=()=>{if(timer!==undefined){cancel(timer);timer=undefined;}};
 const arm=delay=>{clear();if(!paused&&count>1)timer=schedule(tick,delay);};
 const tick=()=>{timer=undefined;const next=(index+1)%count;if(ready(next)){index=next;onChange(index);}arm(intervalMs);};
 const go=value=>{if(count<1)return;const next=(value%count+count)%count;if(next!==index){index=next;onChange(index);}arm(intervalMs);};
 return {
  get index(){return index;},get paused(){return paused;},
  reset(size,start=0){count=size;index=size?Math.min(Math.max(start,0),size-1):0;onChange(index);arm(intervalMs);},
  go,step:direction=>go(index+direction),
  pause(){paused=true;clear();},
  resume(){if(!paused)return;paused=false;arm(resumeMs+intervalMs);}
 };
}

// Remote keys with the focus on the TV carousel banner (its Play button). «carousel»: Left/Right change the
// recommendation directly (the focus stays), OK is a press (short = play, held = reveal Mi lista). «actions»
// (after a held OK): Left/Right alternate Play and Mi lista, OK clicks natively, Back returns to «carousel».
// null = not the banner's key (Up/Down leave the banner and the blur returns it to «carousel»).
export function bannerKeyAction({key,mode}){
 if(mode==='actions')return key==='ArrowLeft'||key==='ArrowRight'?'toggle':key==='Escape'?'exit':null;
 return key==='ArrowLeft'?'previous':key==='ArrowRight'?'next':key==='Enter'?'press':null;
}
