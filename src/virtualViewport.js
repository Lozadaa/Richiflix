import {createScrollGlide} from './scrollGlide.js';
const glides=new WeakMap();
// F9 calibration knob for TV scroll glides. 90–150 ms cost +0.8–3 ms of P95 key→2nd RAF in pc-experience (liveRemote, CPU 4×,
// over its 34.4 ms gate) because the glide ends between keys; it stays at the PC bounds until the Samsung says otherwise.
export const TV_GLIDE_MS={min:140,max:220};
// R1.6, TV scene (.tv-mode .page-scene): the glide runs on the compositor. One instant scrollTo lands on the
// destination and, in the same task, the scene content (.content) starts translate3d(0,shift,0) → 0 by Web
// Animations, shift = destination − drawn offset, so the first frame shows the same pixels and the content
// slides into place with no scroll read or write per frame. The scroll lands first (not at the end) so the
// virtual rows and grid mount the destination before it shows. A retarget mid-flight starts from where the
// content is drawn: viewportOffset() is that drawn offset (scrollTop − remaining shift).
// ponytail: .content gains a layer only while it slides (R3 decides on a permanent one).
export const GLIDE_EASE='cubic-bezier(.33,1,.68,1)';// ≈ 1-(1-t)^3, the curve of createScrollGlide (PC, window)
export const glideFrames=shift=>[{transform:`translate3d(0,${shift}px,0)`},{transform:'translate3d(0,0,0)'}];
// Remaining shift of a glide at its eased progress (getComputedTiming().progress; null once it has ended).
export const glideShiftAt=(shift,progress)=>progress==null?0:shift*(1-progress);
const sceneContent=viewport=>viewport!==window&&viewport.matches?.('.tv-mode .page-scene')?viewport.querySelector(':scope > .content'):null;
const drawnShift=viewport=>{const glide=glides.get(viewport);return glide?.animation?glideShiftAt(glide.shift,glide.animation.effect?.getComputedTiming().progress):0;};
export const viewportIsGliding=viewport=>{const glide=glides.get(viewport);return glide?.animation?glide.animation.playState==='running':glide?.moving||false;};
export function cancelViewportGlide(viewport){const glide=glides.get(viewport);if(glide?.animation)glide.animation.cancel();else glide?.stop();glides.delete(viewport);}
// A banner zone boundary changes the viewport's top once. Compose that compensation with any unfinished
// vertical glide so a quick Down/Up does not start two animations competing for the same content transform.
export function shiftViewportFrame(viewport,shift){
 const content=sceneContent(viewport),combined=shift+drawnShift(viewport);
 cancelViewportGlide(viewport);
 if(!content?.animate||Math.abs(combined)<1||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 const glide={shift:combined,animation:content.animate(glideFrames(combined),{duration:180,easing:GLIDE_EASE})};
 glides.set(viewport,glide);glide.animation.onfinish=()=>{if(glides.get(viewport)===glide)glides.delete(viewport);};
}
export function glideViewportBy(viewport,delta){
 // Clamp to the scroll range: the last, partial row cannot start a glide that the browser truncates.
 const offset=viewportOffset(viewport),max=viewport===window?Infinity:viewport.scrollHeight-viewport.clientHeight,target=Math.max(0,Math.min(offset+(delta||0),max>=0?max:Infinity));
 const current=glides.get(viewport);
 if(current?.animation){
  if(Math.abs(target-viewport.scrollTop)<1&&current.animation.playState==='running')return;
  // Freeze the drawn position before starting from it (or stopping on it).
  current.animation.cancel();glides.delete(viewport);if(Math.abs(target-offset)<1){viewport.scrollTo({top:target,behavior:'instant'});return;}
 }
 if(Math.abs(target-offset)<1){current?.stop?.();return;}
 const smooth=window.matchMedia&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&typeof window.requestAnimationFrame==='function';
 if(!smooth){cancelViewportGlide(viewport);viewport.scrollTo({top:target,behavior:'instant'});return;}
 const content=sceneContent(viewport);
 if(content?.animate){
  current?.stop?.();viewport.scrollTo({top:target,behavior:'instant'});noteTop(viewport,target);
  const shift=target-offset,glide={shift,animation:content.animate(glideFrames(shift),{duration:Math.min(TV_GLIDE_MS.max,Math.max(TV_GLIDE_MS.min,Math.abs(shift)*.2)),easing:GLIDE_EASE})};
  glides.set(viewport,glide);glide.animation.onfinish=()=>{if(glides.get(viewport)===glide)glides.delete(viewport);};
  return;
 }
 let glide=current?.animation?undefined:current;
 if(!glide){glide=createScrollGlide({read:()=>viewportOffset(viewport),write:top=>viewport.scrollTo({top,behavior:'instant'}),request:callback=>window.requestAnimationFrame(callback),cancel:frame=>window.cancelAnimationFrame(frame),now:()=>performance.now(),...(viewport.closest?.('.tv-mode')?TV_GLIDE_MS:{})});glides.set(viewport,glide);}
 glide.to(target);
}
// Ola 4: getComputedStyle(main) forced a style recalc in every rail mount effect (176 ms in 20 keys on the TV). The
// answer only changes with the main element or the TV mode, so it is cached per main and mode.
const viewports=new WeakMap();
export function scrollViewport(element){
 const main=element.closest('main');if(!main)return window;
 const tv=Boolean(main.closest('.tv-mode')),known=viewports.get(main);if(known?.tv===tv)return known.value;
 const value=/auto|scroll/.test(getComputedStyle(main).overflowY)?main:window;viewports.set(main,{tv,value});return value;
}
export const viewportHeight=viewport=>viewport===window?window.innerHeight:viewport.clientHeight;
export const viewportOffset=viewport=>viewport===window?window.scrollY:viewport.scrollTop-drawnShift(viewport);
// Ola 4: the scene's scrollTop as of its last scroll event (or our own scrollTo), so a remote key can tell whether the
// scene moved without reading scrollTop (a forced layout, ~9 ms per key on the TV). First call per scene reads it once.
const knownTops=new WeakMap();
// It is the scroll destination (a running glide's target), not the drawn offset.
export function knownViewportTop(viewport){
 if(viewport===window)return window.scrollY;
 if(!knownTops.has(viewport)){knownTops.set(viewport,viewport.scrollTop);viewport.addEventListener('scroll',()=>knownTops.set(viewport,viewport.scrollTop),{passive:true});}
 return knownTops.get(viewport);
}
const noteTop=(viewport,top)=>{if(knownTops.has(viewport))knownTops.set(viewport,top);};
export function viewportRevealDelta({top,bottom,viewportTop,height,margin=24}){
 if(bottom-top>height-2*margin||top<viewportTop+margin)return top-viewportTop-margin;
 if(bottom>viewportTop+height-margin)return bottom-viewportTop-height+margin;
 return 0;
}
// TV (scrolling .page-scene): the focused row snaps to the top edge less a fixed margin, never half-hidden
// under the fixed banner; the first row returns to 0 so headings above it come back. Live pages (Fase L3)
// snap every row, the first included, so the expanded panel has room under the title and chips; Up reveals them.
export const viewportAlignDelta=({top,viewportTop,offset,margin=24,first=false})=>first?-offset:Math.max(-offset,top-viewportTop-margin);
export function revealGridIndex(element,layout,index,viewport){
 const gridTop=element.getBoundingClientRect().top,viewportTop=viewport===window?0:viewport.getBoundingClientRect().top,height=viewportHeight(viewport),row=Math.floor(index/layout.columns);
 // The live channel grid's first row brings its «Canales» heading along (a stable container).
 const heading=row===0?element.closest?.('.live-hub-channels'):null,top=heading?heading.getBoundingClientRect().top:gridTop+layout.paddingTop+row*layout.rowHeight,bottom=gridTop+layout.paddingTop+(row+1)*layout.rowHeight-(layout.rowGap||0);
 glideViewportBy(viewport,viewport===window?viewportRevealDelta({top,bottom,viewportTop,height}):viewportAlignDelta({top,viewportTop,offset:viewportOffset(viewport),first:row===0&&!element.closest?.('.live-hub')}));
}
// R1.7: a row's top inside the scrolled content only changes with the content's layout, so it is read once per
// row and kept until a ResizeObserver on the content reports a new size (page changes bring new nodes).
let rowTops=new WeakMap();const watchedViewports=new WeakSet();
function contentTop(row,viewport,offset){
 let top=rowTops.get(row);if(top!==undefined)return top;
 top=row.getBoundingClientRect().top-viewport.getBoundingClientRect().top+offset;rowTops.set(row,top);
 const content=viewport.firstElementChild;
 if(content&&typeof ResizeObserver==='function'&&!watchedViewports.has(viewport)){watchedViewports.add(viewport);new ResizeObserver(()=>{rowTops=new WeakMap();}).observe(content);}
 return top;
}
export function revealRailCard(element,_index,viewport=scrollViewport(element)){
 if(viewport===window)return;
 // Stable containers only: the row section (heading included) and the viewport, never a scaling Card.
 const row=element.closest?.('.catalog-row')||element,offset=viewportOffset(viewport);
 glideViewportBy(viewport,viewportAlignDelta({top:contentTop(row,viewport,offset)-offset,viewportTop:0,offset,first:viewport.querySelector?.('.catalog-row')===row&&!row.closest?.('.live-hub')}));
}
