import React,{memo,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Play,Plus,Check,Info} from 'lucide-react';
import {identityStyle,channelTitle} from './ContentIdentity.jsx';
import {displayTitle,logoURL,artworkURL} from './artwork.js';
import {BannerArtwork} from './BannerArtwork.jsx';
import {TrailerPreview} from './TrailerPreview.jsx';
import {matchupFor,scoreLabelFor} from './matchup.js';
import {displayText} from './displayText.js';
import {CategoryMark} from './CategoryMark.jsx';
import {useEventPhase} from './EventBadge.jsx';
import {eventCountdown} from './eventTime.js';
import {eventPhaseLine} from './liveEvents.js';
import {guideNowLine} from './channelGuide.js';
import {isTVBuild} from './platform.js';
import {TitleFacts} from './UserScore.jsx';
import {knobOn,hexToRgb,dotCycle} from './bannerFlow.js';
const FADE_MS=320;
// «A continuación» thumbnail: the TMDB backdrop at w300 (the card's w780 is three times the bytes for a 160 px tile).
const thumbURL=value=>artworkURL(value)?.replace('/t/p/w780/','/t/p/w300/');
// H1-T4: the title logo (TMDB, H3) replaces the h1 only once decoded; the next slide's logo decodes ahead so the
// copy never swaps h1 → img mid-slide (that would be a Layout after the text has settled).
const decodedLogos=new Set();
function decodeLogo(src){if(!src||decodedLogos.has(src))return Promise.resolve();const image=new Image();image.decoding='async';image.src=src;return image.decode().then(()=>{decodedLogos.add(src);});}
function StageTitle({item,live}){
 const title=live?channelTitle(item):displayTitle(item),src=!live&&item.logoImage?logoURL(item.logoImage):'';
 const [ready,setReady]=useState(()=>decodedLogos.has(src));
 useEffect(()=>{if(!src||ready)return;let alive=true;decodeLogo(src).then(()=>{if(alive)setReady(true);},()=>{});return()=>{alive=false;};},[src,ready]);
 return src&&ready?<img className="title-logo" src={src} alt={title} decoding="sync"/>:<h1>{title}</h1>;
}
export const FocusStage=memo(function FocusStage({item,active,visible=true,loading=false,metadataPending=loading,moving=false,open,inspect,favorite,toggle,tv,hover,leave,trailerDelay=0,next,nextPending=false,slide=0,slides=0,choose,onNextArt,profileId,paused=false,onStageFocus}){
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
 // «Destacado vivo» (TV carousel): the banner is a calm hero. Its buttons are ordinary (Left/Right walk ▶ · Mi lista ·
 // Más info · A continuación, OK clicks); the recommendation changes only by itself while nobody is in the banner
 // (App pauses the clock on onStageFocus) or with OK on «A continuación». No dots, no held OK.
 const labeled=Boolean(tv&&choose);
 // Inicio con vida: the knobs --tv-kenburns / --tv-ambient (0/1 on .app.tv-mode) are read once on mount, never per key.
 const [knobs,setKnobs]=useState(null),[dot,setDot]=useState(null),[frozen,setFrozen]=useState(false),stageRef=useRef();
 if(carousel){const nextDot=dotCycle(dot,{slide,paused});if(nextDot!==dot)setDot(nextDot);}
 useEffect(()=>{if(!tv)return;const style=getComputedStyle(document.querySelector('.app')||document.documentElement);setKnobs({kenburns:knobOn(style.getPropertyValue('--tv-kenburns')),ambient:knobOn(style.getPropertyValue('--tv-ambient'))});},[tv]);
 if(!item)return null;const live=item.kind==='iptv',matchup=matchupFor(item),remoteActions=isTVBuild&&tv,dormant=remoteActions&&!actionsFocused;
 const out=carousel&&layers.out&&layers.out.id!==item.id?layers.out:null,upcomingArt=carousel&&next&&next.id!==item.id&&next.id!==out?.id?next:null;
 useEffect(()=>{if(next?.logoImage)decodeLogo(logoURL(next.logoImage)).catch(()=>{});},[next?.logoImage]);
 // Paused carousel (focus in the rows, dialogs, hidden tab): the Ken Burns is frozen at its current scale as a static
 // transform and the animation removed, so the art, shade and copy stop being compositor layers while browsing.
 // One computed-style read on the pause itself (the key that leaves the banner), never per key.
 useEffect(()=>{if(!carousel||!tv)return;const art=stageRef.current?.querySelector('.focus-stage-visual.is-current');if(paused){if(art){const t=getComputedStyle(art).transform;art.style.setProperty('--kb-freeze',t&&t!=='none'?t:'none');}setFrozen(true);}else{art?.style.removeProperty('--kb-freeze');setFrozen(false);}},[paused,carousel,tv]);
 // H1-T2 ambient wash: the slide's own --identity-ink (identityStyle, already the stage's style) goes into the free
 // layer only when the slide changes, in this same render that makes its art layer is-current, and only once that art
 // is decoded (until then the outgoing art and its tint stay). Never in keyDown; renders that keep the slide are no-ops.
 const identity=identityStyle(item),ambient=carousel&&tv&&knobs?.ambient;
 // The tint is painted inside each art layer (BannerArtwork ::after, --wash-ink-rgb): the crossfade carries it, zero layers.
 const tintOf=entry=>ambient&&entry?hexToRgb(identityStyle(entry)['--identity-ink'])||undefined:undefined;
 return <section className={`hero focus-stage ${tv?'tv-stage':'pointer-stage'} ${carousel?'carousel-stage':''} ${live?'channel-stage':''} ${matchup?'mlb-stage':''}`} data-content-id={item.id} data-stage-visible={visible?'true':'false'} aria-hidden={!visible?true:undefined} data-stage-state={moving?'browsing':'settled'} data-slide={carousel?slide:undefined} data-kenburns={carousel&&knobs?.kenburns?'true':undefined} data-paused={carousel&&frozen?'true':undefined} data-ambient={ambient?'true':undefined} ref={stageRef} aria-label={carousel?'Recomendaciones':'Vista del título seleccionado'} style={identity} onMouseEnter={hover} onMouseLeave={leave} onFocus={event=>{if(remoteActions)setActionsFocused(true);if(!event.currentTarget.contains(event.relatedTarget))onStageFocus?.(true);hover?.(event);}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)){setActionsFocused(false);onStageFocus?.(false);leave?.();}}}>
  {<TrailerPreview id={live?undefined:item.trailerId} active={!live&&active} delay={trailerDelay}/>}
  {[out&&<BannerArtwork key={out.id} item={out} tint={tintOf(out)} className="is-out"/>,<BannerArtwork key={item.id} item={item} tint={tintOf(item)} metadataPending={metadataPending} className={carousel?'is-current':undefined} onState={carousel?artChanged:undefined}/>,upcomingArt&&<BannerArtwork key={upcomingArt.id} item={upcomingArt} tint={tintOf(upcomingArt)} metadataPending={nextPending} className="is-next" onState={onNextArt}/>]}
  <div className="focus-stage-shade"/>
  <div className="focus-stage-copy">
   <React.Fragment key={item.id}><span className="focus-eyebrow"><CategoryMark item={item}/>{displayText(live?(!event?['EN DIRECTO',item.genre]:event.phase==='upcoming'?[event.label.toLocaleUpperCase('es'),eventCountdown(item).label]:[event.label.toLocaleUpperCase('es'),event.phase==='postponed'?'':event.time,item.genre]).filter(Boolean).join(' · '):item.contentGenre||item.genre)}{loading&&<span className="focus-info-loader" role="status" aria-label="Cargando información"/>}</span>
   <StageTitle item={item} live={live}/>
   <p className="focus-description">{displayText(live?event?event.phase==='live'&&matchup?.teams[1]&&scoreLabelFor(item.eventScore,matchup.teams[0].id)?`En juego · ${scoreLabelFor(item.eventScore,matchup.teams[0].id).text}`:eventPhaseLine(item,event):guideNowLine(item.guide)||['Televisión en directo',item.genre].filter(Boolean).join(' · '):item.description||item.genre)}</p>
   <TitleFacts item={item}/>
   {item.cast&&<p className="focus-cast">{displayText(item.cast)}</p>}</React.Fragment>
   <div className={`focus-actions${labeled?' is-labeled':''}`} role="group" aria-label="Acciones del título seleccionado" aria-hidden={dormant?true:undefined}>
    <button className="primary" tabIndex={dormant?-1:undefined} aria-label={item.mediaType==='series'?'Ver episodios':'Reproducir'} onClick={()=>item.mediaType==='series'?inspect(item):open(item)}><Play fill="currentColor" aria-hidden="true"/>{labeled&&<span>{item.mediaType==='series'?'Ver episodios':'Reproducir'}</span>}</button>
    <button className="secondary" tabIndex={dormant?-1:undefined} aria-label={favorite?'Quitar de Mi lista':'Guardar en Mi lista'} aria-pressed={favorite} onClick={()=>toggle(item)}>{favorite?<Check aria-hidden="true"/>:<Plus aria-hidden="true"/>}{labeled&&<span>{favorite?'En Mi lista':'Mi lista'}</span>}</button>
    {labeled&&!live&&<button className="secondary focus-more" tabIndex={dormant?-1:undefined} aria-label={`Más información de ${displayTitle(item)}`} onClick={()=>inspect(item)}><Info aria-hidden="true"/><span>Más info</span></button>}
   </div>
  </div>
  {/* The next recommendation instead of dots: what comes, and a thin line that fills while the banner rotates by itself. */}
  {labeled&&next&&slides>1&&<button className="banner-next" tabIndex={dormant?-1:undefined} aria-label={`A continuación: ${next.kind==='iptv'?channelTitle(next):displayTitle(next)}. Ver ahora`} onClick={()=>choose(slide+1)}>
   <span className="banner-next-art" aria-hidden="true">{thumbURL(next.backdropImage||next.image)&&<img src={thumbURL(next.backdropImage||next.image)} alt="" decoding="async"/>}</span>
   <span className="banner-next-copy"><small>A continuación</small><b>{next.kind==='iptv'?channelTitle(next):displayTitle(next)}</b></span>
   <i key={`${slide}:${dot?.cycle??0}`} className={`banner-next-progress${dot?.resumed?' is-resumed':''}`} aria-hidden="true"/>
  </button>}
 </section>;
});
