import React,{memo,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {BrandMark} from './Brand.jsx';
import {imagePresentation,isVectorSource} from './imageQuality.js';
import {observeImageBox} from './imageObserver.js';
import {isScreenBackdrop,responsivePosterArtwork} from './responsiveArtwork.js';
import {useCachedArtwork} from './useCachedArtwork.js';
import {noteArtworkShown} from './artworkPrefetch.js';
import {isTVBuild} from './platform.js';
const reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// Fase G: a placeholder never mounts inside a burst of remote keys (it would add
// work to those frames); it waits for 250 ms without catalogue navigation.
// Ola 4: on the TV the identity veil (glyph, shapes, title) waits 700 ms without keys: mounting it between keys of a
// browse added 15–20 ms of style and layout to the next key (measured in the keydown's forced recalc).
let lastNavigation=-Infinity;const quietMs=isTVBuild?700:250;
window.addEventListener('richiflix-catalog-navigation',()=>{lastNavigation=performance.now();});

// A new source gets its own component, so a late decode cannot reveal the old art.
export function QualityImage(props){return <DecodedImage key={props.src||'empty'} {...props}/>;}

// R6.2: memoized; `priority` (fetchPriority) only matters before the image is shown, so once a render saw it ready
// a priority flip (card selected/unselected) does not rerender it. `fallback` may be a function of `failed` (no image or error).
const shownProps=new WeakSet();
const sameImage=(previous,next)=>{for(const key in next)if(key!=='priority'&&previous[key]!==next[key])return false;for(const key in previous)if(!(key in next))return false;return previous.priority===next.priority||shownProps.has(previous);};
const DecodedImage=memo(function DecodedImage(props){
 const {src,className='',fit='cover',eager=false,priority=eager,fallback=true,fallbackWhileLoading=true,placeholderDelay=120,pending=false,loader=false,position,minVisibleSize=0,sizeHint=0,fixedSrc=false,onReadyChange,onStateChange}=props;
 // R4: fixedSrc shows this exact URL (no responsive variant) and accepts it
 // upscaled, like the TV's w1280 backdrops: already-decoded pixels beat a new decode.
 const upscale=fixedSrc||isScreenBackdrop(src);
 const box=useRef(),picture=useRef(),decoded=useRef(false),measure=useRef(()=>{}),layoutBox=useRef(null);
 const [presentation,setPresentation]=useState({state:src?'loading':'empty',ready:false});
 const [boxSize,setBoxSize]=useState({width:sizeHint,dpr:window.devicePixelRatio});
 const responsive=fixedSrc?null:responsivePosterArtwork(src,boxSize.width,boxSize.dpr),imageSource=responsive?.src||src;
 const cached=useCachedArtwork(imageSource,!responsive?.pending),displaySource=cached.src;
 // Fase G: the identity covers a slow load only after placeholderDelay (a cached
 // poster never flashes it) and stays mounted, fading, until the poster is in.
 const [late,setLate]=useState(!placeholderDelay),[,release]=useState(0),hold=useRef(false);
 useEffect(()=>{if(late||presentation.ready||!fallback||!fallbackWhileLoading)return;let timer;const wait=delay=>{timer=setTimeout(()=>{const busy=quietMs-(performance.now()-lastNavigation);if(busy>0)wait(busy);else setLate(true);},delay);};wait(placeholderDelay);return()=>clearTimeout(timer);},[presentation.ready]);
 useLayoutEffect(()=>{
  let active=true;layoutBox.current=null;
  // sizeHint: the first read waits for the ResizeObserver callback (after layout)
  // instead of forcing a layout inside the mount commit.
  // R7: the ResizeObserver entry carries the layout box; after decoding reuse it instead of getBoundingClientRect().
  const update=(cause=false)=>{
   if(!active||!box.current)return;
   if(cause?.contentRect)layoutBox.current=cause.contentRect;
   // Ola 4: on mount the ResizeObserver's first entry (after layout, same frame) gives the width; reading clientWidth
   // here forced a style+layout inside every card mount commit (≈ 700 ms in 20 keys on the TV).
   if(!fixedSrc&&!(cause===true&&(sizeHint||typeof ResizeObserver==='function'))&&responsivePosterArtwork(src,0,window.devicePixelRatio)){
    const layoutWidth=cause?.contentRect?cause.contentRect.width:layoutBox.current?layoutBox.current.width:box.current.clientWidth;
    setBoxSize(previous=>Math.abs(previous.width-layoutWidth)<1&&previous.dpr===window.devicePixelRatio?previous:{width:layoutWidth,dpr:window.devicePixelRatio});
   }
   if(!decoded.current||!picture.current)return;
   const rect=layoutBox.current||box.current.getBoundingClientRect();
   const image=picture.current;
   const result=imagePresentation({width:rect.width,height:rect.height,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,dpr:window.devicePixelRatio,fit,vector:isVectorSource(src)});
   if(upscale&&fit==='cover'&&rect.width&&rect.height&&image.naturalWidth)result.ready=true;
   if(result.ready&&fit==='contain'&&Math.max(result.width||0,result.height||0)<minVisibleSize)result.ready=false;
   const next={...result,state:result.ready?'ready':'low-resolution'};
   setPresentation(previous=>previous.state===next.state&&previous.width===next.width&&previous.height===next.height?previous:next);
  };
  measure.current=update;
  const unobserve=observeImageBox(box.current,update);update(true);
  return()=>{active=false;measure.current=()=>{};unobserve();};
 },[src,fit,minVisibleSize,fixedSrc]);
 useLayoutEffect(()=>{decoded.current=false;setPresentation({state:src?'loading':'empty',ready:false});},[displaySource,src]);
 useEffect(()=>{onReadyChange?.(presentation.ready);},[onReadyChange,presentation.ready]);
 useEffect(()=>{onStateChange?.(presentation.state);},[onStateChange,presentation.state]);
 const reveal=async event=>{
  const image=event.currentTarget,loadedSource=image.src;
  try{if(image.decode)await image.decode();}catch{if(picture.current===image&&image.src===loadedSource&&!cached.failed())setPresentation({state:'unavailable',ready:false});return;}
  if(picture.current!==image||image.src!==loadedSource)return;
  decoded.current=true;measure.current();cached.remember();noteArtworkShown(imageSource);
 };
 const waiting=!presentation.ready&&(presentation.state==='loading'||pending);
 const veil=Boolean(fallback)&&(presentation.ready?hold.current&&!reducedMotion():waiting?fallbackWhileLoading&&late:true);
 if(!presentation.ready)hold.current=veil;else shownProps.add(props);
 useEffect(()=>{if(!presentation.ready||!hold.current)return;const timer=setTimeout(()=>{hold.current=false;release(value=>value+1);},220);return()=>clearTimeout(timer);},[presentation.ready]);
 return <div ref={box} className={`quality-media ${className} ${fit==='contain'?'quality-logo':''}`} data-image-state={pending&&!src?'pending':presentation.state}>
  {loader&&waiting&&<span className="artwork-spinner" aria-hidden="true"/>}
  {veil&&<div className="richiflix-art" aria-hidden="true">{fallback===true?<><BrandMark/><i/></>:typeof fallback==='function'?fallback(!waiting&&!presentation.ready):fallback}</div>}
  {displaySource&&!responsive?.pending&&<img ref={picture} src={displaySource} alt="" loading={eager?'eager':'lazy'} fetchPriority={priority?'high':'auto'} decoding="async" draggable="false" onLoad={reveal} onError={()=>{decoded.current=false;if(!cached.failed())setPresentation({state:'unavailable',ready:false});}} style={{opacity:presentation.ready?1:0,objectFit:fit,objectPosition:position,'--image-scale':presentation.scale}}/>}
 </div>;
},sameImage);
