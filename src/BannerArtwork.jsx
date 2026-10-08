import React,{useCallback,useEffect,useState} from 'react';
import {QualityImage} from './QualityImage.jsx';
import {artworkURL} from './artwork.js';
import {mlbMatchup} from './mlbArtwork.js';
import {MatchupArtwork} from './MatchupArtwork.jsx';

function useArtworkState(src){
 const [result,setResult]=useState({src,state:src?'loading':'empty'});
 const update=useCallback(state=>setResult(previous=>previous.src===src&&previous.state===state?previous:{src,state}),[src]);
 // A changed URL is pending on its first render, before passive image callbacks.
 return [result.src===src?result.state:src?'loading':'empty',update];
}

export function BannerArtwork({item,metadataPending=false,variant='focus',className,onState}){
 const live=item.kind==='iptv',focus=variant==='focus',matchup=live?mlbMatchup(item):null;
 const backdrop=live?(focus?undefined:item.imageGeneric?undefined:artworkURL(item.image)):artworkURL(item.backdropImage,true);
 const [backdropState,backdropChanged]=useArtworkState(backdrop);
 const ready=backdropState==='ready';
 const pending=!ready&&(metadataPending||backdropState==='loading');
 const state=ready?'ready':pending?'loading':'missing';
 // A carousel asks its prepainted next layer whether rotating is safe yet.
 useEffect(()=>{onState?.(item.id,state);},[onState,item.id,state]);
 return <div className={(focus?'focus-stage-visual':'hero-visual')+(className?' '+className:'')} data-artwork-state={state} aria-busy={pending?true:undefined}>
  {/* A game keeps its local crests inside the layer, so the carousel's opacity fade carries them too. */}
  {focus&&matchup&&<MatchupArtwork matchup={matchup} wide item={item}/>}
  {backdrop&&<QualityImage className={focus?'focus-backdrop hero-art':'hero-art'} src={backdrop} fit={live?'contain':'cover'} position={focus?undefined:'70% center'} eager fallback={false} fallbackWhileLoading={false} onStateChange={backdropChanged}/>}
 </div>;
}
