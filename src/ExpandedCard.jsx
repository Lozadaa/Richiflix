import {AgeBadge} from './AgeBadge.jsx';
import React,{createContext,useContext,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Play,Plus,Check,ArrowRight} from 'lucide-react';
import {QualityImage} from './QualityImage.jsx';
import {ContentIdentity,identityStyle,channelTitle} from './ContentIdentity.jsx';
import {MatchupArtwork} from './MatchupArtwork.jsx';
import {mlbMatchup} from './mlbArtwork.js';
import {artworkURL,displayTitle,titleFacts} from './artwork.js';
import {displayText} from './displayText.js';
import {tvPanelPoster} from './responsiveArtwork.js';
import {UserScore} from './UserScore.jsx';
import {EventBadge,useEventPhase} from './EventBadge.jsx';
import {preferredFeed,rememberFeed,eventPhaseLine} from './liveEvents.js';
import {useCardExpansion} from './useCardExpansion.js';
import {currentGuide,guideProgress,guideNextLine} from './channelGuide.js';
import {claimCardTrailer} from './cardTrailerStore.js';
import {okHint} from './cardExpansion.js';
import {eventTeams,teamLabel,teamAbbreviation} from './followedTeams.js';
import './expandedCard.css';
import './followedTeams.css';

// Fase L7: App provides the followed teams through context (portals keep it), so no Card prop changes.
export const FollowContext=createContext({teams:[],toggleTeam:null});
// R4.4: on the TV the panel opens with the card's own w342 (already decoded, CSS
// cover ≈1.34×) and layers the sharp variant on top after this rest with it open.
export const PANEL_SHARP_DELAY_MS=600;

// The preview's local timers and geometry must never rerender the catalogue Card.
export function SelectedCardExpansion({anchor,controller,...props}){
 const hint=useMemo(()=>okHint(props.profileId),[props.profileId]);
 const expansion=useCardExpansion(anchor,true,props.instanceId,props.tv,()=>props.open(props.item),props.item.kind==='iptv',hint.mastered,Boolean(props.item.isEvent&&props.item.feeds.length>1));
 useLayoutEffect(()=>{
  controller.current=expansion;const card=anchor.current,button=card?.querySelector('.card-open');card?.classList.toggle('is-expanded',Boolean(expansion.placement));button?.setAttribute('aria-expanded',String(Boolean(expansion.placement)));
  return()=>{controller.current=null;card?.classList.remove('is-expanded');button?.setAttribute('aria-expanded','false');};
 });
 return <ExpandedCard {...props} expansion={expansion} hint={hint}/>;
}

export function ExpandedCard({item,instanceId,expansion,metadataPending,favorite,toggle,open,tv,index=0,total=0,remaining='',kids=false,hint}){
 const trailer=useRef(),opened=Boolean(expansion.placement);
 // Decided once per opening, so counting this opening never hides the hint mid-view.
 const showHint=useMemo(()=>Boolean(tv&&opened&&hint?.visible()),[tv,opened,hint]);
 useEffect(()=>{if(showHint)hint.shown();},[showHint,hint]);
 const phase=useEventPhase(item.isEvent?item:null,true),follow=useContext(FollowContext);
 const [sharpFor,setSharpFor]=useState(null);
 useEffect(()=>{if(!tv||!opened)return;const timer=setTimeout(()=>setSharpFor(item.id),PANEL_SHARP_DELAY_MS);return()=>{clearTimeout(timer);setSharpFor(previous=>previous===null?previous:null);};},[tv,opened,item.id]);
 useLayoutEffect(()=>{
  if(!expansion.placement||item.kind==='iptv')return;
  const frame=tv?expansion.placement.trailer:null;
  return claimCardTrailer(trailer.current,item.trailerId,frame?.position||expansion.placement,frame?.stage||null);
 },[Boolean(expansion.placement),item.kind,item.trailerId,tv]);
 const position=expansion.placement;if(!position)return null;
 const live=item.kind==='iptv',matchup=mlbMatchup(item),title=live?channelTitle(item):displayTitle(item),facts=titleFacts(item);
 const artwork=live?(item.imageGeneric?undefined:artworkURL(item.image)):tv?artworkURL(item.image)||artworkURL(item.backdropImage,true):artworkURL(item.backdropImage,true)||artworkURL(item.image);
 // The card's poster URL (w342 at 1080p): same key, same retained blob, no decode.
 const cardPoster=tv&&!live&&!matchup?tvPanelPoster(artwork,artworkURL(item.image)):null;
 const description=displayText(item.description),genericLive=description===`${item.source} · En vivo`,audio=displayText(item.audioLanguage||'');
 const feeds=item.isEvent&&item.feeds.length>1?item.feeds:null,chosen=feeds&&preferredFeed(item);
 const phaseLine=eventPhaseLine(item,phase),teams=item.isEvent&&follow.toggleTeam?eventTeams(item):[];
 // Fase L4: progress is computed when the panel paints (no timer); reopening recomputes it.
 const guide=live&&!item.isEvent?currentGuide(item.guide):null,guideBar=guide&&guideProgress(guide.now),guideNext=guide&&guideNextLine(item.guide);
 const key=event=>{
  if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();event.stopPropagation();const buttons=[...expansion.surface.current.querySelectorAll('.expansion-actions button,.expansion-feeds button')],index=buttons.indexOf(event.target),next=(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus({preventScroll:true});}
  else if(['Escape','ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();event.stopPropagation();expansion.restore();}
 };
 return createPortal(<section ref={expansion.surface} className={`card-expansion ${tv?'expansion-tv':''} ${live?'expansion-live':''} ${item.isEvent?'expansion-event':''} ${guide?'expansion-guided':''} ${kids?'expansion-kids':''}`} role="group" aria-label={`Vista previa de ${title}`} data-card-owner={instanceId} data-content-id={item.id} style={{...identityStyle(item),left:position.left,top:position.top,width:position.width,height:position.height}} onKeyDown={key} onKeyUp={expansion.keyUp}>
  <span className="expansion-backplate" aria-hidden="true"/>
  {!live&&<div ref={trailer} className="expansion-trailer" aria-hidden="true"/>}
  <div className="expansion-media" aria-hidden="true" onClick={()=>open(item)}>
   {matchup?<MatchupArtwork matchup={matchup} wide={!tv}/>:<QualityImage className={live?'expansion-logo':'expansion-art'} src={cardPoster||artwork} fixedSrc={Boolean(cardPoster)} fit={live?'contain':'cover'} minVisibleSize={live?72:0} sizeHint={position.width*(tv?.46:1)} eager pending={!live&&metadataPending&&!artwork} loader fallbackWhileLoading={false} fallback={<ContentIdentity item={item} channel={live} wide/>}/>}
   {cardPoster&&sharpFor===item.id&&<QualityImage className="expansion-art" src={artwork} sizeHint={position.width*.46} fallback={false} fallbackWhileLoading={false}/>}
   {live&&<EventBadge item={item} fine channel/>}
   <span className="expansion-media-shade"/><AgeBadge item={item}/>
  </div>
  <div className="expansion-body"><h3>{title}</h3>
   {item.isEvent?<p className="expansion-event-phase" data-event-state={phase?.phase}>{phaseLine}</p>:guide?<div className="expansion-guide"><p className="expansion-guide-now">Ahora · {displayText(guide.now.title)}</p>{guideBar!=null&&<span className="expansion-guide-bar" aria-hidden="true"><i style={{transform:`scaleX(${guideBar})`}}/></span>}{guideNext&&<p className="expansion-guide-next">{displayText(guideNext)}</p>}</div>:description&&!genericLive?<p className="expansion-description">{description}</p>:metadataPending&&!live?<div className="expansion-synopsis-loading" role="status" aria-label="Cargando información"><span/><span/></div>:null}
   {!guide&&<div className="expansion-facts">{!live&&!kids&&<UserScore item={item} compact/>}{!live&&facts&&<span>{facts}{audio&&!facts.includes(audio)?` · ${audio}`:''}</span>}{live&&<span>{displayText(item.isEvent?item.genre:item.source||item.genre)}</span>}{(tv||item.resumeLabel)&&remaining&&<span className="expansion-remaining">{remaining}</span>}</div>}
   <div className="expansion-actions" onKeyDown={key}><button className="expansion-play" aria-label={`${item.mediaType==='series'?'Ver episodios de':'Reproducir'} ${title}`} onClick={()=>open(item)} tabIndex={tv?-1:0}>{item.mediaType==='series'?<ArrowRight aria-hidden="true"/>:<Play fill="currentColor" aria-hidden="true"/>}</button><button className="expansion-save" aria-label={`${favorite?'Quitar':'Guardar'} ${title} ${favorite?'de':'en'} Mi lista`} aria-pressed={favorite} onClick={()=>toggle(item)} tabIndex={tv?-1:0}>{favorite?<Check aria-hidden="true"/>:<Plus aria-hidden="true"/>}</button>{teams.map(id=>{const followed=follow.teams.includes(id);return <button key={id} className="expansion-follow" aria-pressed={followed} aria-label={`${followed?'Dejar de seguir a':'Seguir a'} ${teamLabel(id)}`} onClick={()=>follow.toggleTeam(id)} tabIndex={tv?-1:0}>{teamAbbreviation(id)}</button>;})}{tv&&total>0&&<span className="expansion-position">{(index+1).toLocaleString('es-CL')} de {total.toLocaleString('es-CL')}</span>}{showHint&&<span className="expansion-remote-hint">Mantén OK para opciones</span>}</div>
   {feeds&&<div className="expansion-feeds" role="group" aria-label="Señales">{feeds.map(feed=><button key={feed.id} className="expansion-feed" aria-pressed={feed.id===chosen.id} aria-label={`Ver con señal ${feed.label}`} tabIndex={tv?-1:0} onClick={()=>{rememberFeed(item,feed.id);open(item);}}>{feed.label}</button>)}</div>}
  </div>
 </section>,document.body);
}
