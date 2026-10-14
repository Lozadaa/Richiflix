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

// Desktop live supervision: decoded progress is the only success signal.
// This also catches silent playlist stalls with no waiting/error event.
export function createLiveRecovery({health,readPosition,readFrames=()=>undefined,readSeeking=()=>false,startLoad,recoverMediaError,swapAudioCodec=()=>{},reload,onReconnecting,now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout,maxReloads=3}){
 let closed=false,timer,decoderTimer,last=readPosition(),frames=readFrames(),advancedAt=now(),actionAt=now(),reloads=0,steps=0,decoders=0,busy=false,failed=false,goodSince=null;
 const tick=()=>{
  timer=undefined;if(closed)return;
  if(health.canRecover()&&!failed){
   const position=readPosition(),nextFrames=readFrames(),time=now();
   // HLS nudges currentTime over gaps without displaying a new frame.
   const hasFrames=Number.isFinite(nextFrames)&&Number.isFinite(frames)&&(nextFrames>0||frames>0);
   const moved=position>last+.5&&(!hasFrames||nextFrames>frames);
   if(!readSeeking()&&moved){last=position;advancedAt=time;goodSince??=time;if(time-goodSince>=10000){reloads=0;steps=0;decoders=0;}}
   else goodSince=null;
   if(readSeeking()||position<last-2)last=position;
   frames=nextFrames;
   const stalled=time-advancedAt;
   if(stalled>=10000){onReconnecting();health.waiting();}
   if(!busy&&stalled>=24000&&time-actionAt>=8000){
    if(reloads>=maxReloads){failed=true;health.fault('Esta emisión no está disponible ahora.');}
    else{reloads++;busy=true;actionAt=time;Promise.resolve().then(()=>{if(!closed&&health.canRecover())return reload();}).catch(()=>{}).finally(()=>{busy=false;});}
   }else if(!busy&&stalled>=12000&&time-actionAt>=Math.min(8000,1000*2**steps)){
    actionAt=time;steps++;try{startLoad();}catch{}
   }
  }else{advancedAt=now();actionAt=now();last=readPosition();frames=readFrames();goodSince=null;}
  if(!closed)timer=schedule(tick,1000);
 };
 timer=schedule(tick,1000);
 return {
  online(){if(!closed&&!failed&&health.canRecover()){onReconnecting();health.waiting();try{startLoad();}catch{}}},
  error(_event,data){
   if(closed||failed||!health.canRecover())return;
   if(data.type==='mediaError'&&(data.details==='bufferAppendError'||data.details==='fragParsingError'||(data.fatal&&!String(data.details).startsWith('buffer')))&&decoders<2&&decoderTimer===undefined){
    onReconnecting();health.waiting();
    decoderTimer=schedule(()=>{decoderTimer=undefined;if(closed||!health.canRecover())return;try{if(decoders++)swapAudioCodec();recoverMediaError();}catch{}},1000*2**decoders);
   }
   if(data.type==='networkError'||data.details==='bufferStalledError'){onReconnecting();health.waiting();}
  },
  dispose(){closed=true;cancel(timer);cancel(decoderTimer);},
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
