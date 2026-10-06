import {useEffect,useRef,useState} from 'react';
import {artworkCacheClient} from './artworkCacheClient.js';
import {cacheableArtwork} from './artworkDiskCache.js';
export function useCachedArtwork(source,enabled=true){
 const cacheable=enabled&&Boolean(cacheableArtwork(source));
 const activeHandle=useRef();
 const [resolved,setResolved]=useState({source,url:cacheable?null:source});
 useEffect(()=>{
  if(!cacheable){setResolved({source,url:source});return;}
  let active=true,decided=false;const cache=artworkCacheClient(),handle=cache.acquire(source);
  activeHandle.current=handle;
  // A cold/blocked storage read cannot hold up an image indefinitely. Once
  // network loading starts, a late cache reply never replaces or flashes it.
  const choose=url=>{if(!active||decided)return;decided=true;if(!url||url===source)handle.release();setResolved({source,url:url||source});};
  const timer=setTimeout(()=>choose(source),90);handle.ready.then(url=>{choose(url);clearTimeout(timer);});
  return()=>{active=false;clearTimeout(timer);handle.release();if(activeHandle.current===handle)activeHandle.current=null;};
 },[source,cacheable]);
 const current=resolved.source===source?resolved.url:cacheable?null:source;
 return {src:current,remember:()=>{if(cacheable&&current===source)void artworkCacheClient().remember(source);},failed:()=>{if(!cacheable||!current?.startsWith('blob:'))return false;activeHandle.current?.release();void artworkCacheClient().forget(source);setResolved({source,url:source});return true;}};
}
