import {artworkURL} from './artwork.js';
const images=new Map(),capacity=2,decodedBudget=20*1024*1024;
const decodedBytes=()=>[...images.values()].reduce((total,image)=>total+image.naturalWidth*image.naturalHeight*4,0);
function trim(){while(images.size>capacity||decodedBytes()>decodedBudget)discard(images.keys().next().value);}
function discard(src){const image=images.get(src);if(image){image.onload=null;image.onerror=null;if(!image.complete)image.src='';}images.delete(src);}
export function clearPreviewArtwork(){for(const src of images.keys())discard(src);}
export function previewArtworkStats(){return {retainedImages:images.size,pendingImages:[...images.values()].filter(image=>!image.complete).length,estimatedDecodedBytes:decodedBytes()};}
export function preloadPreviewArtwork(item){
 for(const src of [item.backdropImage?artworkURL(item.backdropImage,true):artworkURL(item.image)]){
  if(!src)continue;if(images.has(src)){const cached=images.get(src);images.delete(src);images.set(src,cached);continue;}
  const image=new Image();image.decoding='async';image.fetchPriority='low';image.onload=()=>{trim();image.decode?.().catch(()=>{});};image.onerror=()=>images.delete(src);image.src=src;images.set(src,image);trim();
 }
}
