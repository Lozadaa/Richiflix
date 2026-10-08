import {useEffect,useRef,useState} from 'react';
import {artworkCacheClient} from './artworkCacheClient.js';
import {cacheableArtwork} from './artworkDiskCache.js';
import {shownArtwork} from './artworkPrefetch.js';
// R4.3: the first frame already knows the answer when this session decoded the
// poster before: its retained blob URL, or the http URL it was shown (or
// prefetched) with, which Blink's memory cache still holds. Switching a shown
// http poster to a fresh blob would decode it again.
export function initialArtwork(source,cache=artworkCacheClient(),shown=shownArtwork){return cache.peek(source)||(shown.has(source)?source:null);}
export function useCachedArtwork(source,enabled=true){
 const cacheable=enabled&&Boolean(cacheableArtwork(source));
 const activeHandle=useRef();
 const [resolved,setResolved]=useState(()=>({source,url:cacheable?initialArtwork(source):source}));
 useEffect(()=>{
  const settle=url=>setResolved(previous=>previous.source===source&&previous.url===url?previous:{source,url});
  if(!cacheable){settle(source);return;}
  const cache=artworkCacheClient(),known=initialArtwork(source,cache);
  if(known===source){settle(source);return;}
  let active=true,decided=false;const handle=cache.acquire(source);
  activeHandle.current=handle;
  // A cold/blocked storage read cannot hold up an image indefinitely. Once
  // network loading starts, a late cache reply never replaces or flashes it.
  const choose=url=>{if(!active||decided)return;decided=true;if(!url||url===source)handle.release();settle(url||source);};
  const timer=setTimeout(()=>choose(source),90);handle.ready.then(url=>{choose(url);clearTimeout(timer);});
  return()=>{active=false;clearTimeout(timer);handle.release();if(activeHandle.current===handle)activeHandle.current=null;};
 },[source,cacheable]);
 const current=resolved.source===source?resolved.url:cacheable?null:source;
 return {src:current,remember:()=>{if(cacheable&&current===source)void artworkCacheClient().remember(source);},failed:()=>{if(!cacheable||!current?.startsWith('blob:'))return false;activeHandle.current?.release();void artworkCacheClient().forget(source);setResolved({source,url:source});return true;}};
}
