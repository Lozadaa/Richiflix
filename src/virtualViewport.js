import {createScrollGlide} from './scrollGlide.js';
const glides=new WeakMap();
export const viewportIsGliding=viewport=>glides.get(viewport)?.moving||false;
export function cancelViewportGlide(viewport){glides.get(viewport)?.stop();glides.delete(viewport);}
export function glideViewportBy(viewport,delta){
 if(!delta)return;
 const target=viewportOffset(viewport)+delta;
 const smooth=window.matchMedia&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&typeof window.requestAnimationFrame==='function';
 if(!smooth){cancelViewportGlide(viewport);viewport.scrollTo({top:target,behavior:'instant'});return;}
 let glide=glides.get(viewport);
 if(!glide){glide=createScrollGlide({read:()=>viewportOffset(viewport),write:top=>viewport.scrollTo({top,behavior:'instant'}),request:callback=>window.requestAnimationFrame(callback),cancel:frame=>window.cancelAnimationFrame(frame),now:()=>performance.now()});glides.set(viewport,glide);}
 glide.to(target);
}
export function scrollViewport(element){
 const main=element.closest('main');return main&&/auto|scroll/.test(getComputedStyle(main).overflowY)?main:window;
}
export const viewportHeight=viewport=>viewport===window?window.innerHeight:viewport.clientHeight;
export const viewportOffset=viewport=>viewport===window?window.scrollY:viewport.scrollTop;
export function viewportRevealDelta({top,bottom,viewportTop,height,margin=24}){
 if(bottom-top>height-2*margin||top<viewportTop+margin)return top-viewportTop-margin;
 if(bottom>viewportTop+height-margin)return bottom-viewportTop-height+margin;
 return 0;
}
export function revealGridIndex(element,layout,index,viewport){
 const gridTop=element.getBoundingClientRect().top,viewportTop=viewport===window?0:viewport.getBoundingClientRect().top,height=viewportHeight(viewport);
 const top=gridTop+layout.paddingTop+Math.floor(index/layout.columns)*layout.rowHeight,bottom=top+layout.rowHeight-(layout.rowGap||0);
 const delta=viewportRevealDelta({top,bottom,viewportTop,height});
 glideViewportBy(viewport,delta);
}
export function revealRailCard(element,_index,viewport=scrollViewport(element)){
 if(viewport===window)return;
 // The rail already reserves padding for the enlarged card and focus ring.
 // Measuring an animating Card made horizontal navigation move the catalogue
 // vertically as its 1.08 scale changed. Its stable container is the viewport.
 const target=element.getBoundingClientRect(),bounds=viewport.getBoundingClientRect(),height=viewportHeight(viewport);
 const delta=viewportRevealDelta({top:target.top,bottom:target.bottom,viewportTop:bounds.top,height});
 glideViewportBy(viewport,delta);
}
