// Android TV (Google TV): an AVPlay-shaped facade over the app's native ExoPlayer (window.KingdomNative, see
// android/…/NativePlayer.kt), so Player.jsx and createAVPlayer (avplay.js) drive both TVs the same way.
// Times are milliseconds, like Samsung's API. The native side reports back through window.__kingdomPlayer(type, json).
export function createAndroidAVPlay(native,host=globalThis.window){
 let state='NONE',listener={},prepared=null,seeking=null,duration=0;
 const settle=(pending,success,value)=>{if(!pending)return;try{(success?pending[0]:pending[1])?.(value);}catch{}};
 host.__kingdomPlayer=(type,raw)=>{
  let data={};try{data=typeof raw==='string'?JSON.parse(raw||'{}'):raw||{};}catch{}
  if(type==='ready'){duration=Number(data.duration)||0;if(prepared){state='READY';const pending=prepared;prepared=null;settle(pending,true);}}
  else if(type==='buffering')listener.onbufferingstart?.();
  else if(type==='buffered')listener.onbufferingcomplete?.();
  else if(type==='time'){if(Number(data.duration)>0)duration=Number(data.duration);listener.oncurrentplaytime?.(Number(data.position)||0);}
  else if(type==='seeked'){const pending=seeking;seeking=null;settle(pending,true);}
  else if(type==='ended'){state='PAUSED';listener.onstreamcompleted?.();}
  else if(type==='subtitle')listener.onsubtitlechange?.(Number(data.duration)||3000,String(data.text||''));
  else if(type==='error'){
   const message=String(data.message||'PLAYER_ERROR');
   if(prepared){const pending=prepared;prepared=null;state='NONE';settle(pending,false,message);}
   else{const pending=seeking;seeking=null;settle(pending,false,message);listener.onerror?.(message);}
  }
 };
 return {
  getState:()=>state,
  open(url){native.open(String(url));state='IDLE';duration=0;},
  // The native surface always fills the screen behind the transparent WebView; letterboxing is ExoPlayer's.
  setDisplayRect(){},setDisplayMethod(){},
  setListener(value){listener=value||{};},
  prepareAsync(success,failure){prepared=[success,failure];native.prepare();},
  getDuration:()=>duration,
  play(){native.play();state='PLAYING';},
  pause(){native.pause();state='PAUSED';},
  seekTo(milliseconds,success,failure){seeking=[success,failure];native.seekTo(Math.max(0,Math.round(milliseconds)));},
  stop(){native.stop();if(state!=='NONE')state='IDLE';},
  close(){native.close();state='NONE';listener={};prepared=null;seeking=null;duration=0;},
  suspend(){native.suspend();},
  restoreAsync(_url,_position,_reset,success){native.restore();success?.();},
  getTotalTrackInfo(){try{return JSON.parse(native.tracks()||'[]');}catch{return [];}},
  setSelectTrack(type,index){native.selectTrack(String(type),Number(index));},
 };
}
