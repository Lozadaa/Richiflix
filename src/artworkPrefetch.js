import {artworkCacheClient} from './artworkCacheClient.js';
import {cacheableArtwork} from './artworkDiskCache.js';
import {responsivePosterArtwork} from './responsiveArtwork.js';

// Fase G: posters a card will request soon, nearest first and at the exact
// responsive URL its QualityImage chooses, so the browser/disk cache answers.
// URLs a card already revealed are shared here; nothing asks for them again.
export const shownArtwork=new Map();
export function noteArtworkShown(url,now=Date.now()){if(!url)return;shownArtwork.delete(url);shownArtwork.set(url,now);if(shownArtwork.size>400)shownArtwork.delete(shownArtwork.keys().next().value);}

// R4.5: on the TV only the next row (≤ 8 posters), two at a time, and never while
// a mounted poster is still loading or decoding: the 3 worker threads that raster
// the screen also decode, so the visible window always goes first.
export const tvPrefetchOptions={concurrency:2,queueLimit:8,ready:()=>!document.querySelector('.poster-art[data-image-state="loading"]')};
export function createArtworkPrefetch({load,concurrency=3,queueLimit=24,now=Date.now,done=new Map(),ttl=10*60000,ready=()=>true,retryMs=200}){
 const running=new Map();let queue=[],paused=false,started=0,retry=null;
 const settled=url=>now()-(done.get(url)??-Infinity)<ttl;
 const stop=url=>{const job=running.get(url);running.delete(url);job?.cancel();};
 function pump(){
  if(paused||running.size>=concurrency||!queue.length)return;
  if(!ready()){if(!retry)retry=setTimeout(()=>{retry=null;pump();},retryMs);return;}
  while(!paused&&running.size<concurrency&&queue.length){
  const url=queue.shift(),job=load(url);started++;running.set(url,job);
  job.done.then(ok=>{if(running.get(url)!==job)return;running.delete(url);if(ok){done.delete(url);done.set(url,now());if(done.size>400)done.delete(done.keys().next().value);}pump();});
 }}
 return {
  // items: [{src,distance}]. Abandoned work (no longer planned) is cancelled.
  plan(items,{layoutWidth,dpr=1}={}){
   const wanted=[],seen=new Set();
   for(const {src} of [...items].sort((a,b)=>a.distance-b.distance)){
    const responsive=src&&responsivePosterArtwork(src,layoutWidth,dpr),url=responsive?responsive.src:src;
    if(!url||seen.has(url)||settled(url))continue;seen.add(url);wanted.push(url);if(wanted.length>=queueLimit)break;
   }
   for(const url of [...running.keys()])if(!seen.has(url))stop(url);
   queue=wanted.filter(url=>!running.has(url));pump();return wanted;
  },
  // A burst frees the connections for the cards the user is looking at.
  pause(){if(paused)return;paused=true;const resumed=[...running.keys()];for(const url of resumed)stop(url);queue=[...resumed,...queue].slice(0,queueLimit);},
  resume(){paused=false;pump();},
  clear(){clearTimeout(retry);retry=null;for(const url of [...running.keys()])stop(url);queue=[];},
  stats:()=>({running:running.size,queued:queue.length,done:done.size,paused,started}),
 };
}

// One low-priority Image per running job (≤ concurrency); dropped on completion.
export function loadPosterArtwork(url){
 const image=new Image();let finish;const done=new Promise(resolve=>{finish=resolve;});
 const end=ok=>{image.onload=image.onerror=null;finish(ok);};
 image.decoding='async';image.fetchPriority='low';
 image.onload=()=>{end(true);if(cacheableArtwork(url))void artworkCacheClient().remember(url);};image.onerror=()=>end(false);image.src=url;
 return {done,cancel(){const loading=!image.complete;end(false);if(loading)image.removeAttribute('src');}};
}
