import React,{memo,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Play,Heart,Check} from 'lucide-react';
import {identityStyle,channelTitle} from './ContentIdentity.jsx';
import {displayTitle} from './artwork.js';
import {BannerArtwork} from './BannerArtwork.jsx';
import {TrailerPreview} from './TrailerPreview.jsx';
import {mlbMatchup} from './mlbArtwork.js';
import {displayText} from './displayText.js';
import {CategoryMark} from './CategoryMark.jsx';
import {useEventPhase} from './EventBadge.jsx';
import {eventCountdown} from './eventTime.js';
import {eventPhaseLine} from './liveEvents.js';
import {guideNowLine} from './channelGuide.js';
import {isTVBuild} from './platform.js';
import {scoreLabel} from './mlbSchedule.js';
import {TitleFacts} from './UserScore.jsx';
import {createCardPress,okHint} from './cardExpansion.js';
import {bannerKeyAction,knobOn} from './bannerFlow.js';
const FADE_MS=320;
export const FocusStage=memo(function FocusStage({item,active,visible=true,loading=false,metadataPending=loading,moving=false,open,inspect,favorite,toggle,tv,hover,leave,trailerDelay=0,next,nextPending=false,slide=0,slides=0,choose,onNextArt,profileId,paused=false}){
 const [actionsFocused,setActionsFocused]=useState(false);
 const event=useEventPhase(item,true);
 // Fase C2 carousel: the outgoing art stays mounted under the incoming layer
 // until its opacity fade ends; the next slide's art is mounted and decoded ahead, unpainted (also during a fade, so
 // repeated Right keys keep landing on decoded art).
 // A current layer whose art is not decoded yet stays at opacity 0 (CSS on data-artwork-state) over the outgoing one,
 // which is kept until it arrives: a key changes the text at once and the art fades in when ready, never blocking.
 const carousel=Boolean(choose),[layers,setLayers]=useState({item,out:null}),[art,setArt]=useState({id:null,state:null});
 const arrived=id=>art.id===id&&art.state!=='loading',artChanged=useCallback((id,state)=>setArt(previous=>previous.id===id&&previous.state===state?previous:{id,state}),[]);
 if(carousel&&item&&layers.item!==item)setLayers({item,out:layers.item&&layers.item.id!==item.id&&(arrived(layers.item.id)||!layers.out)?layers.item:layers.out});
 const currentArrived=Boolean(item)&&arrived(item.id);
 useEffect(()=>{if(!layers.out||!currentArrived)return;const timer=setTimeout(()=>setLayers(previous=>({...previous,out:null})),FADE_MS+40);return()=>clearTimeout(timer);},[layers.out,currentArrived]);
 // Direct banner (TV carousel): Left/Right on Play change the slide (bannerKeyAction), held OK reveals Mi lista
 // (createCardPress, as on cards), Back/Up/Down return to the carousel mode. The dots are only an indicator.
 const direct=Boolean(tv&&choose),[mode,setMode]=useState('carousel'),[hintOn,setHintOn]=useState(false),hint=useMemo(()=>okHint(`banner:${profileId}`),[profileId]),latest=useRef(),press=useRef();
 latest.current={item,open,inspect,hint};
 if(!press.current)press.current=createCardPress({short:()=>{const {item,open,inspect}=latest.current;if(item.mediaType==='series')inspect(item);else open(item);},long:()=>{latest.current.hint.mastered();setHintOn(false);setMode('actions');}});
 const keyDown=event=>{
  if(!direct)return;const action=bannerKeyAction({key:event.keyCode===13?'Enter':event.key,mode});if(!action)return;
  if(action==='press'){if(event.target.matches('.primary')){event.preventDefault();press.current.down();}return;}
  event.preventDefault();if(action==='previous'||action==='next'){press.current.cancel();choose(slide+(action==='next'?1:-1));return;}
  const [primary,secondary]=event.currentTarget.querySelectorAll('button');
  if(action==='toggle')(event.target===primary?secondary:primary).focus({preventScroll:true});else{setMode('carousel');primary.focus({preventScroll:true});}
 };
 const keyUp=event=>{if((event.key==='Enter'||event.keyCode===13)&&press.current.pressed){event.preventDefault();press.current.up();}};
 const hidden=direct&&mode==='carousel';
 // Inicio con vida: the knobs --tv-kenburns / --tv-ambient (0/1 on .app.tv-mode) are read once on mount, never per key.
 const [knobs,setKnobs]=useState(null);
 useEffect(()=>{if(!tv)return;const style=getComputedStyle(document.querySelector('.app')||document.documentElement);setKnobs({kenburns:knobOn(style.getPropertyValue('--tv-kenburns')),ambient:knobOn(style.getPropertyValue('--tv-ambient'))});},[tv]);
 if(!item)return null;const live=item.kind==='iptv',matchup=mlbMatchup(item),remoteActions=isTVBuild&&tv,dormant=remoteActions&&!actionsFocused;
 const out=carousel&&layers.out&&layers.out.id!==item.id?layers.out:null,upcomingArt=carousel&&next&&next.id!==item.id&&next.id!==out?.id?next:null;
 return <section className={`hero focus-stage ${tv?'tv-stage':'pointer-stage'} ${carousel?'carousel-stage':''} ${live?'channel-stage':''} ${matchup?'mlb-stage':''}`} data-content-id={item.id} data-stage-visible={visible?'true':'false'} aria-hidden={!visible?true:undefined} data-stage-state={moving?'browsing':'settled'} data-slide={carousel?slide:undefined} data-kenburns={carousel&&knobs?.kenburns?'true':undefined} data-paused={carousel&&paused?'true':undefined} aria-label={carousel?'Recomendaciones':'Vista del título seleccionado'} style={identityStyle(item)} onMouseEnter={hover} onMouseLeave={leave} onFocus={event=>{if(remoteActions)setActionsFocused(true);if(direct&&!event.currentTarget.contains(event.relatedTarget)){const show=hint.visible();setHintOn(show);if(show)hint.shown();}hover?.(event);}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)){setActionsFocused(false);press.current.cancel();setMode('carousel');setHintOn(false);leave?.();}}}>
  {<TrailerPreview id={live?undefined:item.trailerId} active={!live&&active} delay={trailerDelay}/>}
  {[out&&<BannerArtwork key={out.id} item={out} className="is-out"/>,<BannerArtwork key={item.id} item={item} metadataPending={metadataPending} className={carousel?'is-current':undefined} onState={carousel?artChanged:undefined}/>,upcomingArt&&<BannerArtwork key={upcomingArt.id} item={upcomingArt} metadataPending={nextPending} className="is-next" onState={onNextArt}/>]}
  <div className="focus-stage-shade"/>
  <div className="focus-stage-copy">
   <React.Fragment key={item.id}><span className="focus-eyebrow"><CategoryMark item={item}/>{displayText(live?(!event?['EN DIRECTO',item.genre]:event.phase==='upcoming'?[event.label.toLocaleUpperCase('es'),eventCountdown(item).label]:[event.label.toLocaleUpperCase('es'),event.phase==='postponed'?'':event.time,item.genre]).filter(Boolean).join(' · '):item.contentGenre||item.genre)}{loading&&<span className="focus-info-loader" role="status" aria-label="Cargando información"/>}</span>
   <h1>{live?channelTitle(item):displayTitle(item)}</h1>
   <p className="focus-description">{displayText(live?event?event.phase==='live'&&matchup?.teams[1]&&scoreLabel(item.eventScore,matchup.teams[0].id)?`En juego · ${scoreLabel(item.eventScore,matchup.teams[0].id).text}`:eventPhaseLine(item,event):guideNowLine(item.guide)||['Televisión en directo',item.genre].filter(Boolean).join(' · '):item.description||item.genre)}</p>
   <TitleFacts item={item}/>
   {item.cast&&<p className="focus-cast">{displayText(item.cast)}</p>}</React.Fragment>
   <div className={`focus-actions${hidden?' is-direct':''}`} role="group" aria-label="Acciones del título seleccionado" aria-hidden={dormant?true:undefined} onKeyDown={keyDown} onKeyUp={keyUp}><button className="primary" tabIndex={dormant?-1:undefined} aria-label={item.mediaType==='series'?'Ver episodios':'Reproducir'} onClick={()=>item.mediaType==='series'?inspect(item):open(item)}><Play fill="currentColor" aria-hidden="true"/></button><button className="secondary" tabIndex={dormant||hidden?-1:undefined} aria-label={favorite?'Quitar de Mi lista':'Guardar en Mi lista'} aria-pressed={favorite} onClick={()=>toggle(item)}>{favorite?<Check aria-hidden="true"/>:<Heart aria-hidden="true"/>}</button>{hidden&&hintOn&&<span className="focus-remote-hint">Mantén OK para Mi lista</span>}</div>
  </div>
  {carousel&&slides>1&&<div className="banner-dots" role="group" aria-label="Elegir recomendación">{Array.from({length:slides},(_,index)=><button key={index} className={index===slide?'active':''} aria-label={`Recomendación ${index+1} de ${slides}`} aria-pressed={index===slide} tabIndex={-1} onClick={()=>choose(index)}><span/></button>)}</div>}
 </section>;
});
