import {isTVBuild} from './platform.js';
import {BridgePlayer,bridgeFrameURL,normalizeTrailerBridgeURL} from './trailerBridge.js';
const bridgeURL=isTVBuild?normalizeTrailerBridgeURL(import.meta.env?.VITE_TRAILER_BRIDGE_URL):undefined;
export const trailerBridgeEnabled=Boolean(bridgeURL);
let pending;
export function youtubeAPI(){
 if(bridgeURL)return Promise.resolve({Player:BridgePlayer});
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(pending)return pending;
 pending=new Promise((resolve,reject)=>{
  const script=document.createElement('script');let complete=false;
  const previous=window.onYouTubeIframeAPIReady;
  const restore=()=>{if(window.onYouTubeIframeAPIReady===ready)window.onYouTubeIframeAPIReady=previous;};
  const fail=()=>{if(complete)return;complete=true;clearTimeout(timer);restore();script.remove();pending=null;reject(Error('Tráiler no disponible'));};
  const ready=()=>{
   try{previous?.();}catch{}
   if(complete)return;
   if(!window.YT?.Player){fail();return;}
   complete=true;clearTimeout(timer);restore();resolve(window.YT);
  };
  const timer=setTimeout(fail,10000);window.onYouTubeIframeAPIReady=ready;
  script.src='https://www.youtube.com/iframe_api';script.async=true;script.referrerPolicy='strict-origin-when-cross-origin';script.onerror=fail;document.head.appendChild(script);
 });return pending;
}
export function warmTrailerAPI(){
 if(document.hidden||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 for(const href of [...(bridgeURL?[new URL(bridgeURL).origin]:[]),'https://www.youtube-nocookie.com','https://www.youtube.com','https://s.ytimg.com']){
  if(document.querySelector(`link[rel="preconnect"][href="${href}"]`))continue;
  const link=document.createElement('link');link.rel='preconnect';link.href=href;link.crossOrigin='anonymous';document.head.appendChild(link);
 }
 youtubeAPI().catch(()=>{});
}
export const trailerErrorKind=code=>({2:'invalid-video',5:'html5-playback',100:'video-unavailable',101:'embed-disabled',150:'embed-disabled',153:'client-identification','api-unavailable':'api-unavailable','embed-unavailable':'embed-unavailable','playback-unavailable':'playback-unavailable'}[code]||'player-error');
export function trailerFrameURL(id,location=globalThis.location){
 if(bridgeURL)return bridgeFrameURL(bridgeURL,id);
 const url=new URL('https://www.youtube-nocookie.com/embed/'+id);
 const parameters={enablejsapi:1,autoplay:0,controls:0,disablekb:1,fs:0,playsinline:1,rel:0,hl:'es'};
 // A file widget has no HTTP origin. widget_referrer is analytics context,
 // not a replacement for the HTTP client identity required by YouTube.
 if(/^https?:$/.test(location.protocol))parameters.origin=location.origin;
 for(const [key,value] of Object.entries(parameters))url.searchParams.set(key,String(value));
 return url.href;
}
