import {AgeBadge} from './AgeBadge.jsx';
import React,{useLayoutEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {Play,Plus,Check,ArrowRight} from 'lucide-react';
import {QualityImage} from './QualityImage.jsx';
import {ContentIdentity,identityStyle,channelTitle} from './ContentIdentity.jsx';
import {MatchupArtwork} from './MatchupArtwork.jsx';
import {mlbMatchup} from './mlbArtwork.js';
import {artworkURL,displayTitle,titleFacts} from './artwork.js';
import {displayText} from './displayText.js';
import {UserScore} from './UserScore.jsx';
import {EventBadge} from './EventBadge.jsx';
import {useCardExpansion} from './useCardExpansion.js';
import {claimCardTrailer} from './cardTrailerStore.js';
import './expandedCard.css';

// The preview's local timers and geometry must never rerender the catalogue Card.
export function SelectedCardExpansion({anchor,controller,...props}){
 const expansion=useCardExpansion(anchor,true,props.instanceId,props.tv,()=>props.open(props.item),props.item.kind==='iptv');
 useLayoutEffect(()=>{
  controller.current=expansion;const card=anchor.current,button=card?.querySelector('.card-open');card?.classList.toggle('is-expanded',Boolean(expansion.placement));button?.setAttribute('aria-expanded',String(Boolean(expansion.placement)));
  return()=>{controller.current=null;card?.classList.remove('is-expanded');button?.setAttribute('aria-expanded','false');};
 });
 return <ExpandedCard {...props} anchor={anchor} expansion={expansion}/>;
}

export function ExpandedCard({item,instanceId,expansion,metadataPending,favorite,toggle,open,tv,anchor}){
 const trailer=useRef();
 useLayoutEffect(()=>{
  if(!expansion.placement||item.kind==='iptv')return;
  const app=anchor?.current?.closest('.app'),stage=tv?app?.querySelector('.focus-stage.hero'):null,header=app?.querySelector('.topbar');
  let position=expansion.placement;
  if(stage&&header){const headerBox=header.getBoundingClientRect();position={left:0,top:headerBox.bottom,width:window.innerWidth,height:Math.max(0,stage.offsetHeight-headerBox.bottom)};}
  return claimCardTrailer(trailer.current,item.trailerId,position,stage);
 },[Boolean(expansion.placement),item.kind,item.trailerId,tv,anchor]);
 const position=expansion.placement;if(!position)return null;
 const live=item.kind==='iptv',matchup=mlbMatchup(item),title=live?channelTitle(item):displayTitle(item),facts=titleFacts(item);
 const artwork=live?(item.imageGeneric?undefined:artworkURL(item.image)):tv?artworkURL(item.image)||artworkURL(item.backdropImage,true):artworkURL(item.backdropImage,true)||artworkURL(item.image);
 const description=displayText(item.description),genericLive=description===`${item.source} · En vivo`,audio=displayText(item.audioLanguage||'');
 const key=event=>{
  if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();event.stopPropagation();const buttons=[...expansion.surface.current.querySelectorAll('.expansion-actions button')],index=buttons.indexOf(event.target),next=(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus({preventScroll:true});}
  else if(['Escape','ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();event.stopPropagation();expansion.restore();}
 };
 return createPortal(<section ref={expansion.surface} className={`card-expansion ${tv?'expansion-tv':''} ${live?'expansion-live':''}`} role="group" aria-label={`Vista previa de ${title}`} data-card-owner={instanceId} data-content-id={item.id} style={{...identityStyle(item),left:position.left,top:position.top,width:position.width,height:position.height,transformOrigin:`${position.originX}% ${position.originY}%`,'--expansion-from-x':position.scaleX,'--expansion-from-y':position.scaleY}} onKeyDown={key} onKeyUp={expansion.keyUp}>
  <span className="expansion-backplate" aria-hidden="true"/>
  {!live&&<div ref={trailer} className="expansion-trailer" aria-hidden="true"/>}
  <div className="expansion-media" aria-hidden="true" onClick={()=>open(item)}>
   {matchup?<MatchupArtwork matchup={matchup} wide/>:<QualityImage className={live?'expansion-logo':'expansion-art'} src={artwork} fit={live?'contain':'cover'} minVisibleSize={live?72:0} eager pending={!live&&metadataPending&&!artwork} loader fallbackWhileLoading={false} fallback={<ContentIdentity item={item} channel={live} wide/>}/>}
   {live&&<EventBadge item={item}/>}
   <span className="expansion-media-shade"/><AgeBadge item={item}/>
  </div>
  <div className="expansion-body"><h3>{title}</h3>
   {description&&!genericLive?<p className="expansion-description">{description}</p>:metadataPending?<div className="expansion-synopsis-loading" role="status" aria-label="Cargando información"><span/><span/></div>:null}
   <div className="expansion-facts">{!live&&<UserScore item={item} compact/>}{!live&&facts&&<span>{facts}{audio&&!facts.includes(audio)?` · ${audio}`:''}</span>}{live&&<span>{displayText(item.source||item.genre)}</span>}</div>
   <div className="expansion-actions" onKeyDown={key}><button className="expansion-play" aria-label={`${item.mediaType==='series'?'Ver episodios de':'Reproducir'} ${title}`} onClick={()=>open(item)} tabIndex={tv?-1:0}>{item.mediaType==='series'?<ArrowRight aria-hidden="true"/>:<Play fill="currentColor" aria-hidden="true"/>}</button><button className="expansion-save" aria-label={`${favorite?'Quitar':'Guardar'} ${title} ${favorite?'de':'en'} Mi lista`} aria-pressed={favorite} onClick={()=>toggle(item)} tabIndex={tv?-1:0}>{favorite?<Check aria-hidden="true"/>:<Plus aria-hidden="true"/>}</button>{tv&&<span className="expansion-remote-hint">Mantén OK para opciones</span>}</div>
  </div>
 </section>,document.body);
}
