import React,{useCallback,useState} from 'react';
import {QualityImage} from './QualityImage.jsx';
import {ContentIdentity} from './ContentIdentity.jsx';
import {artworkURL} from './artwork.js';

function useArtworkState(src){
 const [result,setResult]=useState({src,state:src?'loading':'empty'});
 const update=useCallback(state=>setResult(previous=>previous.src===src&&previous.state===state?previous:{src,state}),[src]);
 // A changed URL is pending on its first render, before passive image callbacks.
 return [result.src===src?result.state:src?'loading':'empty',update];
}

export function BannerArtwork({item,metadataPending=false,variant='focus'}){
 const live=item.kind==='iptv',focus=variant==='focus';
 const backdrop=live?(focus?undefined:item.imageGeneric?undefined:artworkURL(item.image)):artworkURL(item.backdropImage,true);
 const [backdropState,backdropChanged]=useArtworkState(backdrop);
 const ready=backdropState==='ready';
 const pending=!ready&&(metadataPending||backdropState==='loading');
 const state=ready?'ready':pending?'loading':'missing';
 return <div className={focus?'focus-stage-visual':'hero-visual'} data-artwork-state={state} aria-busy={pending?true:undefined}>
  {backdrop&&<QualityImage className={focus?'focus-backdrop hero-art':'hero-art'} src={backdrop} fit={live?'contain':'cover'} position={focus?undefined:'70% center'} eager fallback={false} fallbackWhileLoading={false} onStateChange={backdropChanged}/>}
  {state==='missing'&&<div className="banner-missing-art" aria-hidden="true"><ContentIdentity item={item} wide/></div>}
 </div>;
}
