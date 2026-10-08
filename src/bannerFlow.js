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

// Inicio con vida: a CSS knob (--tv-kenburns, --tv-ambient) is on unless it reads exactly 0 (unset = the default 1).
export const knobOn=value=>String(value??'').trim()!=='0';

// '#29324e' / '#abc' → '41,50,78' for rgba(var(--wash-ink-rgb),a); an 'r,g,b' triplet passes through; else null.
export function hexToRgb(value){
 const text=String(value??'').trim();
 if(/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/.test(text))return text.split(',').map(part=>Number(part)).join(',');
 const hex=text.replace(/^#/,''),full=hex.length===3?[...hex].map(digit=>digit+digit).join(''):hex;
 if(!/^[0-9a-f]{6}$/i.test(full))return null;
 return [0,2,4].map(start=>parseInt(full.slice(start,start+2),16)).join(',');
}

// H1-T3 dot progress: `cycle` keys the active dot, so its 9 s fill restarts on every slide change and on every resume.
// createBannerCarousel.resume waits resumeMs + intervalMs, so a resumed fill is `resumed` (CSS delays it by resumeMs)
// and still ends when the slide changes. A pause alone keeps the cycle (CSS pauses the running fill).
export function dotCycle(previous,{slide,paused=false}){
 if(!previous)return {slide,paused,cycle:0,resumed:false};
 if(previous.slide!==slide)return {slide,paused,cycle:previous.cycle+1,resumed:false};
 if(previous.paused&&!paused)return {slide,paused,cycle:previous.cycle+1,resumed:true};
 return previous.paused===paused?previous:{...previous,paused};
}

