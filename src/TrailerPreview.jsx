import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {useCardTrailer} from './cardTrailerStore.js';
import {publishPreviewPlayback} from './previewPlaybackStore.js';
import {youtubeID} from './metadata.js';
import {youtubeAPI,trailerFrameURL,trailerErrorKind,trailerBridgeEnabled,trailerGate} from './trailerApi.js';
export {warmTrailerAPI} from './trailerApi.js';
let sequence=0;const IDLE_MS=10000;
function applyAudio(player){player.setVolume?.(100);player.unMute?.();}
export function TrailerPreview({id,active=true,card=false,delay=0}){
 const owner=useCardTrailer();
 const playbackToken=useRef({});
 if(!card&&owner)active=false;
 const root=useRef(),player=useRef(),loaded=useRef(),wanted=useRef(),creating=useRef(false),playerReady=useRef(false),alive=useRef(false),generation=useRef(0),creationTimer=useRef(),playbackTimer=useRef(),exitTimer=useRef(),readyId=useRef(null),lastFrame=useRef(null),exitingId=useRef(null),lastIntent=useRef(),failed=useRef(new Set());
 const [ready,setReady]=useState(null),[exiting,setExiting]=useState(null),[initialized,setInitialized]=useState(0),[visible,setVisible]=useState(()=>!document.hidden),[motion,setMotion]=useState(()=>!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const valid=youtubeID(id),wantKey=active&&motion&&visible&&valid?valid:null;
 // The gate resets during render, so a reselected title never plays early.
 const [gate,setGate]=useState({key:null,open:false}),nextGate=trailerGate(gate,wantKey,delay);if(nextGate!==gate)setGate(nextGate);
 const play=Boolean(wantKey&&nextGate.open);wanted.current={valid,play};
 useEffect(()=>{
  if(!wantKey||!delay)return;let timer;
  // Any key while waiting restarts the quiet period; nothing is created meanwhile.
  const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{window.removeEventListener('keydown',arm,true);setGate(previous=>previous.key===wantKey?{key:wantKey,open:true}:previous);},delay);};
  arm();window.addEventListener('keydown',arm,true);return()=>{clearTimeout(timer);window.removeEventListener('keydown',arm,true);};
 },[wantKey,delay]);
 const pause=()=>{try{player.current?.pauseVideo?.();}catch{}};
 const hide=()=>{readyId.current=null;setReady(null);};
 const clearPlayback=()=>{clearTimeout(playbackTimer.current);playbackTimer.current=undefined;};
 const clearExit=()=>{clearTimeout(exitTimer.current);exitTimer.current=undefined;exitingId.current=null;if(alive.current)setExiting(null);};
 const holdExit=candidate=>{clearExit();exitingId.current=candidate;setExiting(candidate);exitTimer.current=setTimeout(()=>{clearExit();},140);};
 const destroy=()=>{generation.current++;creating.current=false;playerReady.current=false;clearTimeout(creationTimer.current);clearPlayback();clearExit();lastFrame.current=null;try{player.current?.destroy();}catch{}player.current=null;loaded.current=null;root.current?.replaceChildren();};
 const error=(code,kind=code)=>{root.current?.setAttribute('data-trailer-error',String(code));root.current?.setAttribute('data-trailer-error-kind',kind);hide();clearPlayback();};
 const failVideo=(candidate,code,kind=code)=>{clearExit();lastFrame.current=null;if(candidate){failed.current.add(candidate);if(failed.current.size>32)failed.current.delete(failed.current.values().next().value);}error(code,kind);pause();};
 useEffect(()=>{alive.current=true;const media=window.matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setMotion(!media.matches),visibility=()=>setVisible(!document.hidden);media.addEventListener('change',change);document.addEventListener('visibilitychange',visibility);return()=>{alive.current=false;media.removeEventListener('change',change);document.removeEventListener('visibilitychange',visibility);destroy();};},[]);
 useEffect(()=>{if(!motion||!visible){destroy();hide();}},[motion,visible]);
 // R7: a player left paused for IDLE_MS (focus browsing cards, title without trailer) is destroyed, iframe and decoder
 // included; the next play() recreates it through the effect below, so the «Tráilers automáticos» gate is unchanged.
 useEffect(()=>{if(play)return;const timer=setTimeout(()=>{if(player.current||creating.current){destroy();hide();}},IDLE_MS);return()=>clearTimeout(timer);},[play]);
 useEffect(()=>{
  // An inactive title is only a candidate. It must not create an iframe or
  // ask YouTube to cue a video while the remote is still moving.
  if(!play||player.current||creating.current||failed.current.has(valid))return;
  creating.current=true;const session=generation.current;
  youtubeAPI().then(YT=>{
   if(!alive.current||session!==generation.current)return;
   creating.current=false;
   const candidate=wanted.current.valid;if(!root.current||!wanted.current.play||!candidate||failed.current.has(candidate))return;
   creating.current=true;loaded.current=candidate;
   root.current.removeAttribute('data-trailer-error');root.current.removeAttribute('data-trailer-error-kind');
   // Permissions and referrer policy must exist before the first navigation.
   const frame=document.createElement('iframe');frame.id='richiflix-trailer-'+(++sequence);frame.tabIndex=-1;frame.title='Tráiler de portada';frame.setAttribute('allow','autoplay; encrypted-media');frame.referrerPolicy='strict-origin-when-cross-origin';frame.src=trailerFrameURL(candidate);root.current.appendChild(frame);
   const currentSession=()=>alive.current&&session===generation.current;
   const readyTimeout=creationTimer.current=setTimeout(()=>{if(!currentSession())return;failVideo(loaded.current,'embed-unavailable');destroy();},12000);
   try{player.current=new YT.Player(frame,{host:'https://www.youtube-nocookie.com',videoId:candidate,
    playerVars:{autoplay:0,controls:0,disablekb:1,fs:0,playsinline:1,rel:0,hl:'es',...(/^https?:$/.test(location.protocol)?{origin:location.origin}:{})},
    events:{onReady:event=>{if(!currentSession())return;clearTimeout(readyTimeout);creating.current=false;playerReady.current=true;const iframe=event.target.getIframe();iframe.tabIndex=-1;iframe.title='Tráiler de portada';iframe.setAttribute('allow','autoplay; encrypted-media');iframe.referrerPolicy='strict-origin-when-cross-origin';try{applyAudio(event.target);}catch{}if(!wanted.current.play)pause();setInitialized(value=>value+1);},
     onStateChange:event=>{if(!currentSession())return;const shown=player.current?.getVideoData?.()?.video_id,current=Boolean(wanted.current.play&&shown===wanted.current.valid&&!failed.current.has(shown)),playing=event.data===1&&current;if(event.data===1&&!playing){if(exitingId.current&&shown!==exitingId.current){clearExit();lastFrame.current=null;}pause();}if(playing){clearPlayback();clearExit();root.current?.removeAttribute('data-trailer-error');root.current?.removeAttribute('data-trailer-error-kind');readyId.current=shown;lastFrame.current=shown;setReady(shown);}else if(!(event.data===3&&current&&readyId.current===shown))hide();},
     onError:event=>{if(!currentSession())return;failVideo(player.current?.getVideoData?.()?.video_id||loaded.current,event.data,trailerErrorKind(event.data));},
     onAutoplayBlocked:()=>{if(currentSession())failVideo(loaded.current,'autoplay-blocked');}}});
   }catch{clearTimeout(readyTimeout);failVideo(candidate,'embed-unavailable');destroy();}
  }).catch(()=>{if(!alive.current||session!==generation.current)return;creating.current=false;failVideo(wanted.current.valid,'api-unavailable');});
 },[valid,play,initialized]);
 useLayoutEffect(()=>{
  const previous=lastIntent.current;lastIntent.current={valid,play};
  // The decoder pauses immediately, but its last frame remains through the
  // exit fade. A poster must not flash between those layers.
  if(!valid||!motion||!visible||previous?.valid!==valid)clearExit();
  else if(!play&&previous?.play&&lastFrame.current===valid&&loaded.current===valid&&!failed.current.has(valid))holdExit(valid);
  clearPlayback();hide();
  const current=player.current;
  if(!current||!playerReady.current)return;
  // Hide and pause before painting a moving banner. Keep its iframe and
  // decoder; loading another title starts only after the parent settles.
  if(!play||failed.current.has(valid)){pause();return;}
  root.current?.removeAttribute('data-trailer-error');root.current?.removeAttribute('data-trailer-error-kind');
  try{if(loaded.current!==valid){current.pauseVideo?.();current.cueVideoById?.(valid);loaded.current=valid;}applyAudio(current);current.playVideo();}catch{failVideo(valid,'playback-unavailable');return;}
  playbackTimer.current=setTimeout(()=>{if(!alive.current||!wanted.current.play||wanted.current.valid!==valid||readyId.current===valid)return;failVideo(valid,'timeout','playback-timeout');},10000);
  return()=>{clearPlayback();pause();};
 },[valid,play,initialized]);
 const playing=ready===valid&&play,holding=exiting===valid&&valid&&!failed.current.has(valid);
 useLayoutEffect(()=>{publishPreviewPlayback(playbackToken.current,playing);},[playing]);
 useEffect(()=>()=>publishPreviewPlayback(playbackToken.current,false),[]);
 useLayoutEffect(()=>{
  if(!card||!owner?.target)return;
  const deck=root.current?.closest('.card-trailer-deck');
  deck?.setAttribute('data-trailer-state',playing?'playing':'poster');
  const state=playing&&!owner.banner?'playing':'poster';owner.target.dataset.trailerState=state;owner.target.parentElement?.setAttribute('data-trailer-state',state);
  owner.banner?.setAttribute('data-card-trailer',playing?'playing':'pending');
  return()=>{deck?.setAttribute('data-trailer-state','poster');owner.banner?.removeAttribute('data-card-trailer');};
 },[card,owner,playing]);
 return <div ref={root} className={'trailer-preview '+(playing?'is-playing':holding?'is-exiting':'')} data-trailer-state={playing?'playing':'poster'} data-trailer-transport={trailerBridgeEnabled?'bridge':'direct'} data-trailer-muted="false" aria-hidden="true"/>;
}
