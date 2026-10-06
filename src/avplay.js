// Samsung AVPlay uses milliseconds; the shared player uses seconds.
// Calls are guarded by AVPlay state, and callbacks from closed sessions are ignored.
export function createAVPlayer(api,{url,live=false,start=0,onEvent=()=>{},onTracks=()=>{}}){
 let closed=false,suspended=false,hidden=false,seeking=false,pendingSeek=null,pendingAudio=null,current=0,duration=0,paused=true,ended=false;
 const emit=(type,value)=>{if(!closed)onEvent(type,value);};
 const state=()=>api.getState();
 const failure=()=>{paused=true;emit('error');};
 const ranges=()=>({length:live||duration<=0?0:1,start:()=>0,end:()=>duration});
 const driver={
  get currentTime(){return current;},set currentTime(seconds){driver.seek(seconds);},
  get duration(){return live?Infinity:duration;},get paused(){return paused;},get ended(){return ended;},
  get buffered(){return {length:0};},get seekable(){return ranges();},
  play(){try{if(closed||suspended||hidden||!['READY','PAUSED','PLAYING'].includes(state()))return Promise.resolve();api.play();paused=false;ended=false;if(pendingAudio!==null){api.setSelectTrack('AUDIO',pendingAudio);pendingAudio=null;}emit('playing');return Promise.resolve();}catch(error){failure();return Promise.reject(error);}},
  pause(){if(closed||suspended||state()!=='PLAYING')return;try{api.pause();paused=true;emit('pause');}catch{failure();}},
  seek(seconds){
   if(closed||suspended||live||duration<=0||!['READY','PLAYING','PAUSED'].includes(state()))return;
   const next=Math.max(0,Math.min(duration-.1,seconds));
   if(seeking){pendingSeek=next;return;}seeking=true;emit('waiting');
   const complete=()=>{if(closed)return;seeking=false;current=next;ended=false;emit('seeked');emit('timeupdate');if(pendingSeek!==null){const pending=pendingSeek;pendingSeek=null;driver.seek(pending);}};
   try{api.seekTo(Math.round(next*1000),complete,()=>{seeking=false;pendingSeek=null;emit('seeked');});}catch{seeking=false;emit('seeked');}
  },
  selectAudio(index){try{if(closed||suspended)return;if(state()==='PAUSED')pendingAudio=index;else if(state()==='PLAYING')api.setSelectTrack('AUDIO',index);}catch{emit('trackerror');}},
  visibility(isHidden){
   if(closed)return;
   hidden=isHidden;
   try{if(hidden&&!suspended&&['PLAYING','PAUSED'].includes(state())){api.suspend();suspended=true;emit('suspended');}
    else if(!hidden&&suspended){emit('waiting');api.restoreAsync(null,live?null:0,false,()=>{if(closed)return;suspended=false;emit(paused?'pause':'playing');emit('seeked');},()=>{if(closed)return;suspended=false;failure();});}
    else if(!hidden&&state()==='READY')beginPlayback();
   }catch{suspended=false;failure();}
  },
  close(){if(closed)return;closed=true;try{if(['READY','PLAYING','PAUSED'].includes(state()))api.stop();}catch{}try{api.close();}catch{}},
 };
 function beginPlayback(){
   driver.play().then(()=>{
    if(closed)return;
    // Track queries after play avoid READY restrictions with prepareAsync.
    try{onTracks(api.getTotalTrackInfo().filter(track=>track.type==='AUDIO').map(track=>{
     let extra={};try{extra=JSON.parse(track.extra_info);}catch{}
     return {index:track.index,label:extra.language||`Audio ${track.index+1}`};
    }));}catch{}
    emit('durationchange');if(!live&&start>0&&start<duration-5)driver.seek(start);
   }).catch(()=>{});
 }
 try{
  // Do not inherit a decoder session from another source or a previous retry.
  if(state()!=='NONE')api.close();api.open(url);
  api.setDisplayRect(0,0,1920,1080);api.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
  api.setListener({onbufferingstart:()=>emit('waiting'),onbufferingcomplete:()=>emit('canplay'),oncurrentplaytime:milliseconds=>{const next=milliseconds/1000;try{if(!closed&&!hidden&&!suspended&&next>current+.025&&state()==='PLAYING')paused=false;}catch{}current=next;emit('timeupdate');},onstreamcompleted:()=>{paused=true;ended=true;emit('ended');},onerror:failure});
  api.prepareAsync(()=>{
   if(closed)return;
   duration=Math.max(0,api.getDuration()/1000);
   if(hidden){emit('pause');emit('seeked');return;}
   beginPlayback();
  },failure);
 }catch{failure();}
 return driver;
}
