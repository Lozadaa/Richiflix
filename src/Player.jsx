import React,{useEffect,useRef,useState} from 'react';
import {loadHlsLibrary} from './hlsLibrary.js';
import {isTizen,isTVBuild} from './platform.js';
import {createAVPlayer} from './avplay.js';
import {Play,Pause,Volume2,Volume1,VolumeX,RotateCcw,RotateCw,Maximize,Minimize,Settings2,Check,Radio,Antenna,SkipBack,SkipForward,RefreshCcw} from 'lucide-react';
import {Dialog} from './Dialog.jsx';
import {Brand,BrandGlyph} from './Brand.jsx';
import {displayText} from './displayText.js';
import {displayTitle} from './artwork.js';
import {usePlaybackChrome} from './usePlaybackChrome.js';
import {createPlaybackHealth,createHlsRecovery} from './playbackRecovery.js';
import {feedsOf,nextFeed,siblingChannel,eventPhaseLabel,eventPhaseLine} from './liveEvents.js';
import {channelTitle} from './ContentIdentity.jsx';
import {createSeekAccumulator,naturalCross} from './seekAccumulator.js';
import {adjacentEpisode} from './episodeWindow.js';
import {NextEpisodeCard,episodeLabel} from './NextEpisodeCard.jsx';
import {useIntroSkip} from './useIntroSkip.js';
import {playerKeyAction} from './playerKeys.js';
import {trackNames} from './trackNames.js';
import './playerLive.css';
import './playerControls.css';

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const time=value=>{if(!Number.isFinite(value))return '—:—';const seconds=Math.max(0,Math.floor(value));const hours=Math.floor(seconds/3600);return `${hours?hours+':':''}${hours?String(Math.floor(seconds/60)%60).padStart(2,'0'):Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;};
const preference=(key,fallback)=>{try{const value=Number(localStorage.getItem(key));return localStorage.getItem(key)!==null&&Number.isFinite(value)?value:fallback;}catch{return fallback;}};
const emptyMedia={current:0,duration:0,buffered:0,from:0,to:0};
// E1: {index, language, label, codec} → {index, label} with readable Spanish names («Español (Latinoamérica)», «Inglés (2)»).
const named=(tracks,kind)=>{const names=trackNames(tracks,kind);return tracks.map((track,position)=>({index:track.index,label:names[position]}));};

const feedQuality=feed=>displayText(feed.item?.title).match(/\b(?:4K|UHD|FHD|HD|SD)\b/)?.[0];
// L6: ChannelUp/PageUp go to the next signal or channel (TV convention: CH+ = next), ChannelDown/PageDown to the previous.
const CHANNEL_KEYS={ChannelUp:1,PageUp:1,ChannelDown:-1,PageDown:-1};

export function Player({item,start,save,close,change,seasons,series,intros={},setIntros=()=>{},fullscreen,toggleFullscreen,restoreFocus,tvMode=false}){
 const videoRef=useRef(),nativeRef=useRef(),hlsRef=useRef(),healthRef=useRef(),userPaused=useRef(false),seekingRef=useRef(false),saveRef=useRef(save),menuRef=useRef(),optionsRef=useRef(),lastSaved=useRef(-1),resumeAt=useRef(start),scrubbing=useRef(false),scrubValue=useRef(0),feedbackTimer=useRef(),signalRef=useRef(),signalMenuRef=useRef(),switchTimer=useRef(),tried=useRef(new Set(item.tried));
 saveRef.current=save;
 const accumulator=useRef(null);accumulator.current??=createSeekAccumulator();
 // D3: consecutive episodes started by the countdown; any key resets it, the fourth asks «¿Sigues ahí?».
 const autoplays=useRef(0),nextDismissed=useRef(false),lastPosition=useRef(0),startFor=useRef(item.id);
 const tv=tvMode||isTVBuild;
 const [error,setError]=useState(''),[loading,setLoading]=useState(true),[showLoader,setShowLoader]=useState(false),[paused,setPaused]=useState(true),[ended,setEnded]=useState(false),[retry,setRetry]=useState(0);
 const [media,setMedia]=useState(emptyMedia),[scrub,setScrub]=useState(null),[preview,setPreview]=useState(null),[feedback,setFeedback]=useState(''),[pendingSeek,setPendingSeek]=useState(null),[nextCard,setNextCard]=useState(false),[stillThere,setStillThere]=useState(false);
 const [volume,setVolume]=useState(()=>clamp(preference('rf-player-volume',.8),0,1)),[muted,setMuted]=useState(false),[rate,setRate]=useState(1),[options,setOptions]=useState(false);
 const [levels,setLevels]=useState([]),[quality,setQuality]=useState(-1),[audioTracks,setAudioTracks]=useState([]),[audio,setAudio]=useState(0),[captions,setCaptions]=useState([]),[caption,setCaption]=useState(-1);
 const [signals,setSignals]=useState(false),[switching,setSwitching]=useState('');
 const event=item.event,feeds=feedsOf(event),feed=feeds.find(entry=>entry.id===item.feedId);const title=item.kind==='iptv'?channelTitle(event||item):displayTitle(item);if(feed)tried.current.add(feed.id);
 const alternative=event&&nextFeed(event,item.feedId,1,[...tried.current]);
 const chooseQuality=tv?levels.length>1:levels.length>0;
 const hasOptions=!tv||chooseQuality||audioTracks.length>1||captions.length>0;
 const live=item.kind==='iptv'||(media.duration===Infinity);
 const guideNow=item.guide?.now?.title||(typeof item.guide?.now==='string'&&item.guide.now);
 const from=live?media.from:0,to=live?media.to:media.duration;
 const seekable=Number.isFinite(to)&&to>from+1;
 const episodic=item.mediaType==='episode'&&!live,previousEpisode=episodic?adjacentEpisode(seasons,item.id,-1):null,nextEpisode=episodic?adjacentEpisode(seasons,item.id,1):null;
 const position=scrub??media.current;
 const percent=seekable?clamp((position-from)/(to-from)*100,0,100):0;
 const buffered=seekable?clamp((media.buffered-from)/(to-from)*100,0,100):0;
 const chromeHidden=usePlaybackChrome(!paused&&!loading&&!error&&!ended&&!options&&!scrubbing.current,tv);

 const engine=()=>nativeRef.current||videoRef.current;
 const screenSaver=enabled=>{try{const common=window.webapis?.appcommon;if(common)common.setScreenSaver(common.AppCommonScreenSaverState[enabled?'SCREEN_SAVER_ON':'SCREEN_SAVER_OFF'],()=>{},()=>{});}catch{}};
 useEffect(()=>{if(isTizen)screenSaver(paused||Boolean(error)||ended);},[paused,error,ended]);
 useEffect(()=>()=>{if(isTizen)screenSaver(true);},[]);
 const sync=()=>{
  const video=engine();if(!video)return;
  const last=video.seekable.length-1;
  setMedia({current:video.currentTime,duration:video.duration||0,buffered:video.buffered.length?video.buffered.end(video.buffered.length-1):0,from:last>=0?video.seekable.start(last):0,to:last>=0?video.seekable.end(last):0});
 };
 useEffect(()=>{if(!loading){setShowLoader(false);return;}const timer=setTimeout(()=>setShowLoader(true),250);return()=>clearTimeout(timer);},[loading]);
 useEffect(()=>{if(isTizen)return;const video=videoRef.current;if(tv){video.volume=1;video.muted=false;return;}video.volume=volume;video.muted=muted;try{localStorage.setItem('rf-player-volume',String(volume));}catch{}},[volume,muted,tv]);
 useEffect(()=>{if(!isTizen)videoRef.current.playbackRate=tv?1:rate;},[rate,tv]);
 useEffect(()=>{if(options)menuRef.current?.querySelector('select')?.focus({preventScroll:true});},[options]);
 useEffect(()=>{if(signals)signalMenuRef.current?.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});},[signals]);
 useEffect(()=>()=>{clearTimeout(feedbackTimer.current);clearTimeout(switchTimer.current);accumulator.current.cancel();},[]);
 useEffect(()=>{if(error||ended)document.querySelector('.player-dialog .player-state button')?.focus({preventScroll:true});},[error,ended]);

 useEffect(()=>{
  const video=videoRef.current;let hls,stopped=false;
  userPaused.current=false;seekingRef.current=false;video.autoplay=true;
  setError('');setLoading(true);setShowLoader(false);setEnded(false);setPaused(true);setMedia(emptyMedia);setLevels([]);setQuality(-1);setAudioTracks([]);setCaptions([]);setCaption(-1);setOptions(false);setSignals(false);lastSaved.current=-1;accumulator.current.cancel();setPendingSeek(null);setScrub(null);
  // A new episode in the same dialog resumes from its own history entry.
  if(startFor.current!==item.id){startFor.current=item.id;resumeAt.current=start;}setNextCard(false);setStillThere(false);nextDismissed.current=false;lastPosition.current=0;
  const health=createPlaybackHealth({readPosition:()=>engine()?.currentTime||0,readSeeking:()=>!isTizen&&(video.seeking||seekingRef.current),onFailure:message=>{setLoading(false);setError(message);},onHealthy:()=>{const restore=document.activeElement?.closest('.player-state');setError('');setLoading(false);setPaused(false);setEnded(false);if(restore)requestAnimationFrame(()=>{if(healthRef.current===health)document.querySelector('.player-dialog .playback-toggle')?.focus({preventScroll:true});});},onWaiting:()=>setLoading(true)});healthRef.current=health;
  const visibility=()=>health.visibility(document.hidden);document.addEventListener('visibilitychange',visibility);visibility();
  const clearHealth=()=>{health.dispose();if(healthRef.current===health)healthRef.current=null;document.removeEventListener('visibilitychange',visibility);};
  if(isTizen){
   document.documentElement.classList.add('native-playback');
   if(!window.webapis?.avplay){setLoading(false);setError('El reproductor Samsung no est\u00e1 disponible.');return()=>{clearHealth();document.documentElement.classList.remove('native-playback');};}
   const driver=createAVPlayer(window.webapis.avplay,{url:item.url,live:item.kind==='iptv',start:resumeAt.current,onTracks:tracks=>{setAudioTracks(named(tracks,'audio'));if(tracks.length)setAudio(tracks[0].index);},onEvent:type=>{
    if(type==='waiting')health.waiting();
    if(['canplay','seeked'].includes(type)){if(type==='seeked'){health.reposition();if(engine()?.paused)setLoading(false);}sync();}
    // AVPlay's play() callback is a request, not proof of a displayed frame.
    if(type==='playing'){health.resume();health.waiting();setPaused(false);}
    if(type==='pause'){health.pause();setLoading(false);setPaused(true);}
    if(type==='suspended'){setLoading(false);setPaused(true);}
    if(type==='error')health.fault('No pudimos reproducir esta fuente en Samsung TV.');
    if(type==='trackerror')flash('Esta pista no est\u00e1 disponible');
    if(type==='ended'){health.ended();saveRef.current(0,item.id,{ended:true});setEnded(true);setLoading(false);setPaused(true);}
    if(type==='durationchange')sync();
    if(type==='timeupdate'){health.progress();sync();const seconds=Math.floor(nativeRef.current?.currentTime||0);resumeAt.current=seconds;if(item.kind!=='iptv'&&seconds%5===0&&seconds!==lastSaved.current){lastSaved.current=seconds;saveRef.current(seconds,item.id,{duration:nativeRef.current?.duration});}}
   }});
   nativeRef.current=driver;
   const visibility=()=>driver.visibility(document.hidden);document.addEventListener('visibilitychange',visibility);
   return()=>{clearHealth();if(item.kind!=='iptv'&&driver.currentTime>0&&!driver.ended)saveRef.current(Math.floor(driver.currentTime),item.id,{duration:driver.duration});driver.close();nativeRef.current=null;document.removeEventListener('visibilitychange',visibility);document.documentElement.classList.remove('native-playback');};
  }
  const tracks=()=>setCaptions(named(Array.from(video.textTracks,(track,index)=>({index,language:track.language,label:track.label})),'subtitle'));
  const resume=()=>{
   if(!video.seeking)seekingRef.current=false;
   if(userPaused.current){video.pause();setLoading(false);return;}
   if(item.kind!=='iptv'&&Number.isFinite(video.duration)&&resumeAt.current>0&&resumeAt.current<video.duration-5)video.currentTime=resumeAt.current;
   sync();video.play().catch(()=>{setLoading(false);setPaused(true);});tracks();
  };
  video.addEventListener('loadedmetadata',resume);video.textTracks.addEventListener('addtrack',tracks);
  let recovery;
  const startVideo=async()=>{
   if(/\.m3u8(?:\?|$)/i.test(item.url)){
    const Hls=await loadHlsLibrary();if(stopped)return;
    if(Hls.isSupported()){
     hls=new Hls();hlsRef.current=hls;
     recovery=createHlsRecovery({hls,health,url:item.url,live:item.kind==='iptv',readPosition:()=>video.currentTime,readMediaError:()=>video.error,networkType:Hls.ErrorTypes.NETWORK_ERROR,mediaType:Hls.ErrorTypes.MEDIA_ERROR});
     hls.on(Hls.Events.MANIFEST_PARSED,()=>{recovery.manifestParsed();setLevels(hls.levels.map((level,index)=>({index,label:level.height?`${level.height}p`:`${Math.round(level.bitrate/1000)} kbps`})));setAudioTracks(named(hls.audioTracks.map((track,index)=>({index,language:track.lang,label:track.name,codec:track.audioCodec})),'audio'));setAudio(Math.max(0,hls.audioTrack));});
     hls.on(Hls.Events.ERROR,recovery.error);hls.on(Hls.Events.FRAG_BUFFERED,recovery.buffered);
     hls.loadSource(item.url);hls.attachMedia(video);return;
    }
   }
   if(!stopped){video.src=item.url;video.load();}
  };
  startVideo().catch(()=>{if(!stopped){setLoading(false);health.fault('No pudimos preparar el reproductor.');}});
  return()=>{
   stopped=true;clearHealth();recovery?.dispose();
   if(item.kind!=='iptv'&&video.currentTime>0&&!video.ended)saveRef.current(Math.floor(video.currentTime),item.id,{duration:video.duration});
   video.removeEventListener('loadedmetadata',resume);video.textTracks.removeEventListener('addtrack',tracks);hls?.destroy();hlsRef.current=null;video.pause();video.removeAttribute('src');video.load();
  };
 },[item.url,item.feedId,item.id,retry]);

 const pausePlayback=()=>{userPaused.current=true;if(!isTizen)videoRef.current.autoplay=false;healthRef.current?.pause();setLoading(false);engine().pause();};
 const play=()=>{const video=engine();if(video.paused){userPaused.current=false;if(!isTizen)video.autoplay=true;healthRef.current?.resume();setEnded(false);video.play().catch(()=>healthRef.current?.fault('No pudimos iniciar la reproducción.'));}else pausePlayback();};
 const seek=value=>{if(!seekable)return;engine().currentTime=clamp(value,from,Math.max(from,to-.1));resumeAt.current=engine().currentTime;setEnded(false);sync();};
 const flash=label=>{setFeedback(label);clearTimeout(feedbackTimer.current);feedbackTimer.current=setTimeout(()=>setFeedback(''),700);};
 const skip=seconds=>{if(tv&&!seekable)return;seek(engine().currentTime+seconds);flash(`${seconds>0?'+':''}${seconds} s`);};
 // D1: Left/Right (and the media seek keys) accumulate one burst; the bar previews the target and one seek follows.
 const intro=useIntroSkip({item,series,seasons,position:media.current,enabled:episodic&&Boolean(series),intros,setIntros}),introButton=useRef();
 accumulator.current.onApply((target,burst)=>{setPendingSeek(null);setScrub(null);seek(from+target);intro.applied({from:burst.from,to:target});});
 // D4: «Saltar intro» takes the focus when it appears; OK jumps to the end of the window, an arrow or Back dismisses it.
 useEffect(()=>{if(intro.offer)introButton.current?.focus({preventScroll:true});else if(document.activeElement?.closest('.skip-intro'))videoRef.current?.focus({preventScroll:true});},[intro.offer?.key]);
 const introKeys=e=>{if(e.key.startsWith('Arrow')||e.key==='Escape'){e.preventDefault();e.stopPropagation();intro.dismiss();videoRef.current?.focus({preventScroll:true});}};
 const seekBy=({direction,repeat=false,now=false})=>{
  const video=engine();if(!seekable||!video)return;
  const result=accumulator.current.press(direction,{position:video.currentTime-from,duration:to-from,repeat});if(!result)return;
  setPendingSeek({...result,direction});setScrub(from+result.target);flash(`${direction>0?'+':'-'}${result.delta<60?`${result.delta} s`:time(result.delta)}`);
  if(now)accumulator.current.flush();
 };
 // D3: the next-episode card follows playback into the last 30 s (never a jump) or appears when the episode ends.
 useEffect(()=>{const previous=lastPosition.current;lastPosition.current=media.current;if(nextEpisode&&!nextDismissed.current&&naturalCross({previous,position:media.current,duration:media.duration}))setNextCard(true);},[media.current]);
 useEffect(()=>{if(ended&&nextEpisode&&!nextDismissed.current)setNextCard(true);},[ended]);
 const toEpisode=async(target,auto=false)=>{
  if(!target)return;setNextCard(false);
  if(auto&&autoplays.current>=3){pausePlayback();setStillThere(true);return;}
  autoplays.current=auto?autoplays.current+1:0;pill(episodeLabel(target)||displayText(target.title));
  if(!await change?.({episode:target}))pill('Episodio no disponible');
 };
 const dismissNext=()=>{nextDismissed.current=true;setNextCard(false);videoRef.current?.focus({preventScroll:true});};
 const changeVolume=value=>{setVolume(value);setMuted(value===0);};
 const replay=()=>{if(isTizen){resumeAt.current=0;setRetry(prev=>prev+1);return;}seek(from);setEnded(false);engine().play().catch(()=>{});};
 const closeOptions=()=>{setOptions(false);optionsRef.current?.focus({preventScroll:true});};
 const closeSignals=()=>{setSignals(false);signalRef.current?.focus({preventScroll:true});};
 // One route for menu, error state and channel keys: App resolves the URL and replaces `item`; this dialog stays mounted.
 const pill=label=>{setSwitching(label);clearTimeout(switchTimer.current);switchTimer.current=setTimeout(()=>setSwitching(''),1500);};
 const switchTo=async(target,label,trying=false)=>{if(!target)return;pill(label);if(!await change?.({...target,trying}))pill('Señal no disponible');};
 const chooseFeed=entry=>{closeSignals();if(entry.id!==item.feedId)switchTo({feed:entry},entry.label);};
 const tryAnother=()=>{videoRef.current?.focus({preventScroll:true});switchTo({feed:alternative},alternative.label,true);};
 const signalKeys=e=>{
  const choices=[...e.currentTarget.querySelectorAll('button')],index=choices.indexOf(e.target);
  if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();e.stopPropagation();choices[clamp(index+(e.key==='ArrowDown'?1:-1),0,choices.length-1)]?.focus({preventScroll:true});}
  else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();}
 };
 const keyboard=e=>{
  autoplays.current=0;
  if(e.key==='Escape'&&options){e.preventDefault();e.stopPropagation();closeOptions();return;}
  if(e.key==='Escape'&&signals){e.preventDefault();e.stopPropagation();closeSignals();return;}
  if(e.altKey||e.ctrlKey||e.metaKey||e.target.closest('.playback-menu,.player-state,.player-prompt'))return;
  const key=e.key.toLowerCase(),target=e.target,dialog=e.currentTarget;
  const focus=element=>{if(element)requestAnimationFrame(()=>element.focus({preventScroll:true}));};
  // D2: in TV the focus lives on the video or on the button row; the media seek keys go through the window listener.
  if(tv){
   if(e.key.startsWith('Media'))return;
   const action=playerKeyAction({key:e.key,focus:target===videoRef.current?'video':target.closest('.playback-toolbar')?'buttons':'other',repeat:e.repeat,seekable,chromeVisible:!chromeHidden});
   if(key.startsWith('arrow'))e.preventDefault();
   if(!action||action.type==='close')return;
   e.preventDefault();e.stopPropagation();
   if(action.type==='seek')seekBy(action);
   else if(action.type==='focusVideo')videoRef.current?.focus({preventScroll:true});
   else if(action.type==='focusButtons'){if(action.togglePlay&&!e.repeat)play();focus(dialog.querySelector('.playback-toggle:not(:disabled)')||dialog.querySelector('.playback-toolbar button:not(:disabled)'));}
   else{const row=[...dialog.querySelectorAll('.playback-toolbar button:not(:disabled)')].filter(element=>!element.closest('.playback-menu,[inert]'));focus(row[clamp(row.indexOf(target)+action.direction,0,row.length-1)]);}
   return;
  }
  const toolbar=[...dialog.querySelectorAll('.playback-toolbar button:not(:disabled)')].filter(element=>!element.closest('.playback-menu')&&element.getBoundingClientRect().width>0);
  const playControl=toolbar.find(button=>button.classList.contains('playback-toggle'));
  const skips=toolbar.filter(button=>button.classList.contains('skip-tool'));
  const timeline=dialog.querySelector('.seek-track input'),back=dialog.querySelector('.back-button');
  if(key.startsWith('arrow')){
   if(target.matches('.player-volume input')&&(key==='arrowleft'||key==='arrowright'))return;
   e.preventDefault();e.stopPropagation();
   if((target===videoRef.current||target.matches('.player-resume'))){focus(key==='arrowup'?timeline||playControl||toolbar[0]:key==='arrowleft'?skips[0]||playControl||toolbar[0]:key==='arrowright'?skips[1]||toolbar[toolbar.length-1]:playControl||toolbar[0]);return;}
   if(target===timeline){if(key==='arrowleft'||key==='arrowright'){if(seekable)skip(key==='arrowleft'?-10:10);}else focus(key==='arrowup'?back:playControl||toolbar[0]);return;}
   if(target===back){if(key==='arrowdown')focus(timeline||playControl||toolbar[0]);return;}
   if(target.matches('.player-volume input')){focus(key==='arrowup'?timeline||back:videoRef.current);return;}
   const index=toolbar.indexOf(target);
   if(index>=0){if(key==='arrowup')focus(timeline||back);else if(key==='arrowdown')focus(videoRef.current);else focus(toolbar[clamp(index+(key==='arrowright'?1:-1),0,toolbar.length-1)]);}
   return;
  }
  if(target!==videoRef.current||![' ','enter','k','m','f'].includes(key))return;
  e.preventDefault();e.stopPropagation();if(e.repeat)return;
  if(key===' '||key==='enter'||key==='k')play();else if(key==='m')setMuted(prev=>!prev);else toggleFullscreen();
 };
 useEffect(()=>{
  if(!tv)return;
  const remote=event=>{
   if(!['MediaPlay','MediaPause','MediaPlayPause','MediaStop','MediaRewind','MediaFastForward'].includes(event.key))return;
   event.preventDefault();
   const seekKey=playerKeyAction({key:event.key,repeat:event.repeat,seekable});if(seekKey){seekBy(seekKey);return;}if(event.repeat)return;
   if(event.key==='MediaPlay'){userPaused.current=false;if(!isTizen)videoRef.current.autoplay=true;healthRef.current?.resume();engine().play().catch(()=>{});}
   else if(event.key==='MediaPause')pausePlayback();
   else if(event.key==='MediaPlayPause')play();
   else if(event.key==='MediaStop')close();
  };
  window.addEventListener('keydown',remote);return()=>window.removeEventListener('keydown',remote);
 });
 // Samsung ChannelUp/ChannelDown (PageUp/PageDown on PC and Electron): next/previous signal of the event, or channel of the category.
 useEffect(()=>{
  const channel=e=>{
   const direction=CHANNEL_KEYS[e.key];if(!direction||e.altKey||e.ctrlKey||e.metaKey)return;
   if(event){e.preventDefault();if(e.repeat)return;const target=nextFeed(event,item.feedId,direction);if(target)switchTo({feed:target},target.label);return;}
   if(!item.siblings)return;e.preventDefault();if(e.repeat)return;
   const target=siblingChannel(item.siblings.items,item,direction);if(target)switchTo({channel:target},displayTitle(target));
  };
  window.addEventListener('keydown',channel);return()=>window.removeEventListener('keydown',channel);
 });
 const finishScrub=()=>{if(!scrubbing.current)return;scrubbing.current=false;seek(scrubValue.current);setScrub(null);};
 const effectiveVolume=muted?0:volume;
 const VolumeIcon=effectiveVolume===0?VolumeX:effectiveVolume<.5?Volume1:Volume2;

 const toggle=<button className="playback-toggle" aria-label={paused?'Reproducir vídeo':'Pausar vídeo'} disabled={Boolean(error)||ended} onClick={play}>{paused?<Play size={27} fill="currentColor"/>:<Pause size={27} fill="currentColor"/>}</button>;
 const back10=(!tv||seekable)&&<button className="player-tool skip-tool" aria-label="Retroceder 10 segundos" disabled={!seekable||Boolean(error)} onClick={()=>skip(-10)}><span className="skip-glyph" aria-hidden="true"><RotateCcw size={36}/><span className="skip-seconds">10</span></span></button>;
 const forward10=(!tv||seekable)&&<button className="player-tool skip-tool" aria-label="Adelantar 10 segundos" disabled={!seekable||Boolean(error)} onClick={()=>skip(10)}><span className="skip-glyph" aria-hidden="true"><RotateCw size={36}/><span className="skip-seconds">10</span></span></button>;
 const signal=feeds.length>1&&<div className="playback-options player-signal"><button ref={signalRef} className={`player-tool ${signals?'is-selected':''}`} aria-label="Señal" aria-expanded={signals} onClick={()=>setSignals(prev=>!prev)}><Antenna size={25}/><span className="signal-caption">Señal</span></button>
      {signals&&<div ref={signalMenuRef} className="playback-menu signal-menu" role="group" aria-label="Señales del evento" onKeyDown={signalKeys}>
       <div className="playback-menu-title">Señal <Antenna size={15}/></div>
       {feeds.map(entry=><button key={entry.id} className="signal-option" aria-pressed={entry.id===item.feedId} onClick={()=>chooseFeed(entry)}><span>{entry.label}</span>{feedQuality(entry)&&<small>{feedQuality(entry)}</small>}{entry.id===item.feedId&&<Check size={20} aria-hidden="true"/>}</button>)}
      </div>}
     </div>;

 return <Dialog immersive player tvMode={tv} chromeHidden={chromeHidden} close={close} label={`Reproduciendo ${title}`} restoreFocus={restoreFocus} onKeyDownCapture={keyboard}>
  <div className="video-stage">
   <video ref={videoRef} controls={false} autoPlay playsInline tabIndex={0} aria-label={`Vídeo: ${title}`} onClick={play} onKeyUpCapture={e=>{if(e.code==='Space'){e.preventDefault();e.stopPropagation();}}} onWaiting={()=>healthRef.current?.waiting()} onSeeking={()=>{seekingRef.current=true;healthRef.current?.waiting();}} onSeeked={()=>{healthRef.current?.reposition();seekingRef.current=false;if(videoRef.current.paused)setLoading(false);sync();}} onEmptied={()=>{seekingRef.current=false;healthRef.current?.reposition();}} onPlaying={()=>healthRef.current?.playing()} onPause={()=>setPaused(true)} onCanPlay={sync} onProgress={sync} onDurationChange={sync} onVolumeChange={e=>{if(tv)return;setVolume(e.currentTarget.volume);setMuted(e.currentTarget.muted);}} onTimeUpdate={()=>{healthRef.current?.progress();sync();resumeAt.current=videoRef.current.currentTime;const seconds=Math.floor(videoRef.current.currentTime);if(item.kind!=='iptv'&&seconds%5===0&&seconds!==lastSaved.current){lastSaved.current=seconds;saveRef.current(seconds,item.id,{duration:videoRef.current.duration});}}} onError={()=>{if(!isTizen)healthRef.current?.fault('No pudimos reproducir esta fuente.');}} onEnded={()=>{healthRef.current?.ended();saveRef.current(0,item.id,{ended:true});setEnded(true);setLoading(false);}}/>
   {isTizen&&<object className="avplay-surface" type="application/avplayer" aria-hidden="true"/>}
   {showLoader&&loading&&!error&&!ended&&<div className="player-loading" role="status" aria-label="Cargando vídeo"><div className="cinema-loader"><BrandGlyph/></div><span>{item.trying&&media.current===0?'Probando otra señal…':media.current>0?'Cargando…':title}</span></div>}
   {!tv&&paused&&!loading&&!error&&!ended&&<button className="player-resume" aria-label="Reanudar reproducción" onClick={play}><Play size={36} fill="currentColor"/></button>}
   {switching&&<div className="player-switch" role="status">{switching}</div>}
   {feedback&&<div className="seek-feedback" key={feedback} aria-live="polite"><span className="seek-feedback-icon">{feedback.startsWith('-')?<RotateCcw size={34}/>:<RotateCw size={34}/>}</span><strong>{feedback}</strong></div>}
   {error&&<div className="player-state"><span className="player-state-eyebrow">{title}</span><h2>No se pudo reproducir</h2><p role="alert">{displayText(error)}</p><div className="dialog-actions"><button className="primary" onClick={()=>setRetry(prev=>prev+1)}><RotateCcw size={18}/> Reintentar</button>{alternative&&<button className="secondary" onClick={tryAnother}><Antenna size={18}/> Probar otra señal</button>}<button className="secondary" onClick={close}>Volver al catálogo</button></div></div>}
   {intro.offer&&!error&&<button ref={introButton} className="player-prompt skip-intro" onKeyDown={introKeys} onClick={()=>{const end=intro.skip();if(end!=null)seek(end);videoRef.current?.focus({preventScroll:true});}}>{intro.offer.label}</button>}
   {nextCard&&nextEpisode&&!stillThere&&<NextEpisodeCard key={nextEpisode.id} episode={nextEpisode} running={!paused||ended} onPlay={auto=>toEpisode(nextEpisode,auto)} onDismiss={dismissNext} onLeave={()=>videoRef.current?.focus({preventScroll:true})}/>}
   {stillThere&&<section className="player-prompt still-there" aria-label="¿Sigues ahí?" onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();const buttons=[...e.currentTarget.querySelectorAll('button')];buttons[(buttons.indexOf(e.target)+1)%buttons.length]?.focus({preventScroll:true});}}}><h2>¿Sigues ahí?</h2><div className="dialog-actions"><button className="primary" autoFocus onClick={()=>{setStillThere(false);toEpisode(nextEpisode);}}><Play fill="currentColor" size={20}/> Seguir viendo</button><button className="secondary" onClick={close}>Volver al catálogo</button></div></section>}
   {ended&&!nextCard&&!stillThere&&<div className="player-state"><span className="player-state-eyebrow">Reproducción terminada</span><h2>{title}</h2><div className="dialog-actions"><button className="primary" onClick={replay}><Play fill="currentColor" size={20}/> Volver a ver</button><button className="secondary" onClick={close}>Volver al catálogo</button></div></div>}
  </div>
  <div className="player-heading" inert={chromeHidden}><div className="player-title"><span>{event?eventPhaseLine(event,eventPhaseLabel(event))||'En directo':live?['En directo',displayText(item.genre)].filter(Boolean).join(' · '):displayText(item.genre)||'Tu biblioteca'}</span><strong>{title}</strong>{feed?<em className="player-live-line">{feed.label}</em>:guideNow&&<em className="player-live-line">Ahora · {displayText(guideNow)}</em>}</div><span className="player-wordmark" aria-hidden="true"><Brand/></span></div>
  {(!tv||(!error&&!ended))&&<div className="player-controls" inert={chromeHidden} aria-label="Controles de reproducción">
   <div className="playback-meta"><div className="playback-meta-copy"><span className="playback-clock">{live?'En directo':`${time(position)} / ${time(media.duration||NaN)}`}</span>{!tv&&<span className="playback-credit">{displayText(item.credit)||'Tu biblioteca personal'}</span>}</div>{live?!tv&&<button className={`live-edge ${to-position<3?'at-live':''}`} aria-label="Ir al directo" disabled={!seekable} onClick={()=>seek(to-.5)}><Radio size={28} aria-hidden="true"/></button>:!tv&&<span className="remaining-time">{seekable?`${time(Math.max(0,to-position))} restantes`:''}</span>}</div>
   {seekable&&<div className="seek-track" onPointerMove={e=>{const box=e.currentTarget.getBoundingClientRect();setPreview({value:from+clamp((e.clientX-box.left)/box.width,0,1)*(to-from),percent:clamp((e.clientX-box.left)/box.width*100,3,97)});}} onPointerLeave={()=>setPreview(null)}>
    {!tv&&preview&&<output className="seek-preview" style={{left:`${preview.percent}%`}}>{time(live?to-preview.value:preview.value)}</output>}
    {pendingSeek&&<output className="seek-preview seek-pending" style={{left:`${clamp(percent,3,97)}%`}}>{`${pendingSeek.direction>0?'+':'-'}${time(pendingSeek.delta)} · ${time(from+pendingSeek.target)}`}</output>}
    <input type="range" tabIndex={tv?-1:0} aria-hidden={tv||undefined} onFocus={tv?()=>videoRef.current?.focus({preventScroll:true}):undefined} aria-label="Posición de reproducción" aria-valuetext={live?`${time(Math.max(0,to-position))} detrás del directo`:`${time(position)} de ${time(to)}`} min={from} max={to} step="0.1" value={clamp(position,from,to)} style={{'--played':`${percent}%`,'--buffered':`${buffered}%`}} onPointerDown={e=>{scrubbing.current=true;scrubValue.current=position;e.currentTarget.setPointerCapture(e.pointerId);setScrub(position);}} onChange={e=>{const value=Number(e.target.value);if(scrubbing.current){scrubValue.current=value;setScrub(value);}else seek(value);}} onPointerUp={finishScrub} onPointerCancel={()=>{scrubbing.current=false;setScrub(null);}} onLostPointerCapture={finishScrub}/>
   </div>}
   <div className="playback-toolbar">
    <div className="playback-main-controls">
     {tv?<>
      {previousEpisode&&<button className="player-tool has-caption" aria-label="Episodio anterior" onClick={()=>toEpisode(previousEpisode)}><SkipBack size={25}/><span className="tool-caption">Anterior</span></button>}
      {seekable&&!live&&<button className="player-tool has-caption" aria-label="Reiniciar" onClick={()=>seek(from)}><RefreshCcw size={25}/><span className="tool-caption">Reiniciar</span></button>}
      {back10}{toggle}{forward10}
      {nextEpisode&&<button className="player-tool has-caption" aria-label="Siguiente episodio" onClick={()=>toEpisode(nextEpisode)}><SkipForward size={25}/><span className="tool-caption">Siguiente</span></button>}
      {live&&seekable&&to-position>=3&&<button className="player-tool live-edge" aria-label="Ir al directo" onClick={()=>seek(to-.5)}><Radio size={28} aria-hidden="true"/></button>}
     </>:<>{toggle}{back10}{forward10}</>}
     {!tv&&signal}
     {!tv&&<div className="player-volume"><button className="player-tool" aria-label={muted||volume===0?'Activar sonido':'Silenciar'} aria-pressed={muted||volume===0} onClick={()=>{if(volume===0){setVolume(.8);setMuted(false);}else setMuted(prev=>!prev);}}><VolumeIcon size={25}/></button><input type="range" aria-label="Volumen" min="0" max="1" step="0.05" value={effectiveVolume} style={{'--volume':`${effectiveVolume*100}%`}} onChange={e=>changeVolume(Number(e.target.value))}/></div>}
     
    </div>
    {(!tv||hasOptions||feeds.length>1)&&<div className="playback-extra-controls">
     {hasOptions&&<div className="playback-options"><button ref={optionsRef} className={`player-tool ${options?'is-selected':''}`} aria-label="Opciones de reproducción" aria-expanded={options} onClick={()=>setOptions(prev=>!prev)}><Settings2 size={25}/>{rate!==1&&<span className="rate-badge">{rate}×</span>}</button>
      {options&&<div ref={menuRef} className="playback-menu" role="group" aria-label="Opciones de reproducción" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeOptions();}}}>
       <div className="playback-menu-title">A tu ritmo <Check size={15}/></div>
       {!live&&!tv&&<label>Velocidad<select aria-label="Velocidad de reproducción" value={rate} onChange={e=>setRate(Number(e.target.value))}>{[.5,.75,1,1.25,1.5,2].map(value=><option key={value} value={value}>{value===1?'Normal':`${value}×`}</option>)}</select></label>}
       {chooseQuality&&<label>Calidad<select aria-label="Calidad de vídeo" value={quality} onChange={e=>{const value=Number(e.target.value);setQuality(value);if(hlsRef.current)hlsRef.current.currentLevel=value;}}><option value={-1}>Automática</option>{levels.map(level=><option key={level.index} value={level.index}>{displayText(level.label)}</option>)}</select></label>}
       {audioTracks.length>1&&<label>Audio<select aria-label="Pista de audio" value={audio} onChange={e=>{const value=Number(e.target.value);setAudio(value);if(isTizen)nativeRef.current?.selectAudio(value);else if(hlsRef.current)hlsRef.current.audioTrack=value;}}>{audioTracks.map(track=><option key={track.index} value={track.index}>{displayText(track.label)}</option>)}</select></label>}
       {captions.length>0&&<label>Subtítulos<select aria-label="Subtítulos" value={caption} onChange={e=>{const value=Number(e.target.value);setCaption(value);Array.from(videoRef.current.textTracks).forEach((track,index)=>track.mode=index===value?'showing':'disabled');}}><option value={-1}>Desactivados</option>{captions.map(track=><option key={track.index} value={track.index}>{displayText(track.label)}</option>)}</select></label>}
       {(live||isTizen)&&levels.length===0&&audioTracks.length<2&&captions.length===0&&<p>Esta señal usa su calidad original.</p>}
      </div>}
     </div>}
     {tv&&signal}
     {!tv&&<button className="player-tool" aria-label={fullscreen?'Salir de pantalla completa':'Entrar en pantalla completa'} aria-pressed={fullscreen} onClick={toggleFullscreen}>{fullscreen?<Minimize size={25}/>:<Maximize size={25}/>}</button>}
    </div>}
   </div>
  </div>}
 </Dialog>;
}



