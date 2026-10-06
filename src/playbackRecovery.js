// Playback advancement, rather than a network/ready event, confirms recovery.
// Buffering has its own deadline; decoder/setup failures remain actionable.
export function createPlaybackHealth({readPosition,readSeeking=()=>false,onFailure,onHealthy,onWaiting,now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout,grace=6000,bufferGrace=30000}){
 let position=readPosition()||0,advancedAt=now(),fault='',deadline=grace,waiting=false,shown=false,timer,paused=false,hidden=false,closed=false;
 const listeners=new Set();
 const active=()=>!closed&&!paused&&!hidden;
 const notify=()=>listeners.forEach(listener=>listener());
 const clear=()=>{cancel(timer);timer=undefined;};
 const arm=()=>{if(!active()||!fault||shown||timer!==undefined)return;timer=schedule(check,Math.max(1,deadline-(now()-advancedAt)));};
 const healthy=(force=false)=>{const changed=Boolean(fault||waiting||shown);fault='';waiting=false;shown=false;clear();if(changed||force){onHealthy();notify();}};
 const progress=(value=readPosition())=>{
  if(!active())return false;
  if(readSeeking()||!Number.isFinite(value)||value<position){position=value||0;return false;}
  const moved=value>position+.025;position=value;
  if(moved){advancedAt=now();healthy();}
  return moved;
 };
 const check=()=>{timer=undefined;if(!active()||!fault||shown)return;progress();if(!fault)return;if(now()-advancedAt>=deadline){shown=true;onFailure(fault);notify();}else arm();};
 const faulted=(message,{recoverable=false}={})=>{
  if(closed)return;
  const nextDeadline=recoverable?bufferGrace:grace;
  if(!fault){advancedAt=now();deadline=nextDeadline;}else deadline=Math.min(deadline,nextDeadline);
  fault=message;clear();arm();notify();
 };
 return {
  progress,
  reposition(value=readPosition()){position=value||0;},
  fault:faulted,
  waiting(){if(closed)return;waiting=true;faulted('Esta emisión no está disponible ahora.',{recoverable:true});if(active()&&!shown)onWaiting?.();},
  playing(){if(closed)return;paused=false;position=readPosition()||0;advancedAt=now();healthy(true);},
  // Segments arriving do not guarantee the decoder can display them yet.
  networkRestored(){return progress();},
  canRecover:()=>active()&&!shown,
  hasFailed:()=>shown,
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  pause(){paused=true;clear();notify();},
  resume(){if(closed)return;paused=false;advancedAt=now();position=readPosition()||0;arm();notify();},
  visibility(value){hidden=value;clear();if(!hidden){advancedAt=now();arm();}notify();},
  ended(){fault='';waiting=false;paused=true;clear();notify();},
  dispose(){closed=true;fault='';clear();notify();listeners.clear();},
 };
}

export function createHlsRecovery({hls,health,url,networkType,mediaType,live=false,readPosition=()=>hls.media?.currentTime||0,readMediaError=()=>hls.media?.error,schedule=setTimeout,cancel=clearTimeout}){
 let loads=0,decoders=0,manifest=false,timer,closed=false,pending=null;
 const delays=[1000,2000,4000,8000];
 const clear=()=>{cancel(timer);timer=undefined;};
 const arm=()=>{
  if(closed||!pending||timer!==undefined)return;
  if(!health.canRecover()){clear();return;}
  if(pending==='decoder'?decoders>=1:loads>=delays.length){pending=null;return;}
  timer=schedule(()=>{
   timer=undefined;if(closed||!pending||!health.canRecover())return;
   const action=pending;pending=null;
   try{
    if(action==='decoder'){
     // Fatal HLS stalls are MEDIA_ERROR too. Only a genuine decode error
     // justifies discarding MediaSource and the frame currently on screen.
     if(readMediaError()?.code!==3)return;
     const position=readPosition();decoders++;hls.recoverMediaError();
     if(hls.loadingEnabled===false)hls.startLoad(position);
    }else{
     loads++;
     if(manifest)hls.startLoad(readPosition(),true);else hls.loadSource(url);
    }
   }catch{health.fault('No pudimos recuperar esta fuente.');}
  },pending==='decoder'?2000:delays[loads]);
 };
 const unsubscribe=health.subscribe(()=>{if(health.hasFailed())pending=null;if(!health.canRecover())clear();else arm();});
 return {
  manifestParsed(){manifest=true;},
  error(_event,data){
   if(closed||!data.fatal)return;
   const mediaError=readMediaError();
   const stall=data.type===mediaType&&!mediaError&&['bufferStalledError','bufferSeekOverHole'].includes(data.details);
   const network=data.type===networkType;
   health.fault('Esta emisión no está disponible ahora.',{recoverable:stall||(network&&live&&manifest)});
   // Fatal errors stop HLS loading. Resume requests with backoff, preserving
   // MediaSource and position; waiting/nonfatal retries belong to HLS itself.
   const kind=network||stall?'load':data.type===mediaType&&mediaError?.code===3?'decoder':null;
   if(!kind)return;
   if(!pending||kind==='decoder'){if(kind==='decoder')clear();pending=kind;}
   arm();
  },
  buffered(){if(closed||hls.loadingEnabled===false)return;if(pending==='load'){pending=null;clear();}loads=0;health.networkRestored();},
  dispose(){closed=true;pending=null;clear();unsubscribe();},
 };
}
