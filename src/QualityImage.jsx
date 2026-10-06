import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {BrandMark} from './Brand.jsx';
import {imagePresentation,isVectorSource} from './imageQuality.js';
import {observeImageBox} from './imageObserver.js';
import {responsivePosterArtwork} from './responsiveArtwork.js';
import {useCachedArtwork} from './useCachedArtwork.js';

// A new source gets its own component, so a late decode cannot reveal the old art.
export function QualityImage(props){return <DecodedImage key={props.src||'empty'} {...props}/>;}

function DecodedImage({src,className='',fit='cover',eager=false,fallback=true,fallbackWhileLoading=true,pending=false,loader=false,position,minVisibleSize=0,onReadyChange,onStateChange}){
 const box=useRef(),picture=useRef(),decoded=useRef(false),measure=useRef(()=>{});
 const [presentation,setPresentation]=useState({state:src?'loading':'empty',ready:false});
 const [boxSize,setBoxSize]=useState({width:0,dpr:window.devicePixelRatio});
 const responsive=responsivePosterArtwork(src,boxSize.width,boxSize.dpr),imageSource=responsive?.src||src;
 const cached=useCachedArtwork(imageSource,!responsive?.pending),displaySource=cached.src;
 useLayoutEffect(()=>{
  let active=true;
  const update=()=>{
   if(!active||!box.current)return;
   if(responsivePosterArtwork(src,0,window.devicePixelRatio)){
    const layoutWidth=box.current.clientWidth;
    setBoxSize(previous=>Math.abs(previous.width-layoutWidth)<1&&previous.dpr===window.devicePixelRatio?previous:{width:layoutWidth,dpr:window.devicePixelRatio});
   }
   if(!decoded.current||!picture.current)return;
   const rect=box.current.getBoundingClientRect();
   const image=picture.current;
   const result=imagePresentation({width:rect.width,height:rect.height,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,dpr:window.devicePixelRatio,fit,vector:isVectorSource(src)});
   if(result.ready&&fit==='contain'&&Math.max(result.width||0,result.height||0)<minVisibleSize)result.ready=false;
   const next={...result,state:result.ready?'ready':'low-resolution'};
   setPresentation(previous=>previous.state===next.state&&previous.width===next.width&&previous.height===next.height?previous:next);
  };
  measure.current=update;
  const unobserve=observeImageBox(box.current,update);update();
  return()=>{active=false;measure.current=()=>{};unobserve();};
 },[src,fit,minVisibleSize]);
 useLayoutEffect(()=>{decoded.current=false;setPresentation({state:src?'loading':'empty',ready:false});},[displaySource,src]);
 useEffect(()=>{onReadyChange?.(presentation.ready);},[onReadyChange,presentation.ready]);
 useEffect(()=>{onStateChange?.(presentation.state);},[onStateChange,presentation.state]);
 const reveal=async event=>{
  const image=event.currentTarget,loadedSource=image.src;
  try{if(image.decode)await image.decode();}catch{if(picture.current===image&&image.src===loadedSource&&!cached.failed())setPresentation({state:'unavailable',ready:false});return;}
  if(picture.current!==image||image.src!==loadedSource)return;
  decoded.current=true;measure.current();cached.remember();
 };
 const waiting=!presentation.ready&&(presentation.state==='loading'||pending);
 return <div ref={box} className={`quality-media ${className} ${fit==='contain'?'quality-logo':''}`} data-image-state={pending&&!src?'pending':presentation.state}>
  {loader&&waiting&&<span className="artwork-spinner" aria-hidden="true"/>}
  {fallback&&!presentation.ready&&!pending&&(fallbackWhileLoading||presentation.state!=='loading')&&<div className="richiflix-art" aria-hidden="true">{fallback===true?<><BrandMark/><i/></>:fallback}</div>}
  {displaySource&&!responsive?.pending&&<img ref={picture} src={displaySource} alt="" loading={eager?'eager':'lazy'} fetchPriority={eager?'high':'auto'} decoding="async" draggable="false" onLoad={reveal} onError={()=>{decoded.current=false;if(!cached.failed())setPresentation({state:'unavailable',ready:false});}} style={{opacity:presentation.ready?1:0,objectFit:fit,objectPosition:position,width:presentation.width,height:presentation.height}}/>}
 </div>;
}
