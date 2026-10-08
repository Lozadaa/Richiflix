import {artworkURL} from './artwork.js';
import {artworkCacheClient} from './artworkCacheClient.js';
import {cacheableArtwork} from './artworkDiskCache.js';
const images=new Map(),capacity=2,decodedBudget=20*1024*1024;
const decodedBytes=()=>[...images.values()].reduce((total,{image})=>total+image.naturalWidth*image.naturalHeight*4,0);
function trim(){while(images.size>capacity||decodedBytes()>decodedBudget)discard(images.keys().next().value);}
function discard(src){const entry=images.get(src);if(entry){entry.cancelled=true;clearTimeout(entry.timer);entry.handle?.release();entry.image.onload=null;entry.image.onerror=null;if(!entry.image.complete)entry.image.src='';}images.delete(src);}
export function clearPreviewArtwork(){for(const src of images.keys())discard(src);}
export function previewArtworkStats(){return {retainedImages:images.size,pendingImages:[...images.values()].filter(({image})=>!image.complete).length,estimatedDecodedBytes:decodedBytes()};}
export function preloadPreviewArtwork(item){
 for(const src of [item.backdropImage?artworkURL(item.backdropImage,true):artworkURL(item.image)]){
  if(!src)continue;if(images.has(src)){const cached=images.get(src);images.delete(src);images.set(src,cached);continue;}
  const image=new Image(),entry={image,cancelled:false};image.decoding='async';image.fetchPriority='low';
  image.onload=()=>{if(entry.cancelled)return;trim();image.decode?.().catch(()=>{});if(image.src===src&&cacheableArtwork(src))void artworkCacheClient().remember(src);};
  image.onerror=()=>{if(image.src.startsWith('blob:')){entry.handle?.release();void artworkCacheClient().forget(src);image.src=src;}else discard(src);};images.set(src,entry);trim();
  if(entry.cancelled)continue;
  if(cacheableArtwork(src)){entry.handle=artworkCacheClient().acquire(src);let decided=false;const choose=value=>{if(entry.cancelled||decided)return;decided=true;clearTimeout(entry.timer);if(!value)entry.handle.release();image.src=value||src;};entry.timer=setTimeout(()=>choose(null),90);entry.handle.ready.then(choose);}else image.src=src;
 }
}
