import React,{memo,useEffect,useId,useMemo,useRef,useState} from 'react';
import {ArrowUpRight,Check,ChevronLeft,ChevronRight,Heart,Info,Play} from 'lucide-react';
import {QualityImage} from './QualityImage.jsx';
import {artworkURL,displayTitle} from './artwork.js';
import {ContentIdentity,identityStyle,channelTitle} from './ContentIdentity.jsx';
import {mlbMatchup} from './mlbArtwork.js';
import {MatchupArtwork} from './MatchupArtwork.jsx';
import {displayText} from './displayText.js';
import {CategoryMark} from './CategoryMark.jsx';
import {EventBadge} from './EventBadge.jsx';
import {eventCaption} from './liveEvents.js';
import {guideNowLine} from './channelGuide.js';
import {useCardSelected} from './cardSelectionStore.js';
import {useMetadataEntry,metadataTracked} from './metadataStore.js';
import {recordCardRender} from './focusPaintDiagnostics.js';
import {isTVBuild} from './platform.js';
import {BannerArtwork} from './BannerArtwork.jsx';
import {UserScore,TitleFacts} from './UserScore.jsx';
import {SelectedCardExpansion} from './ExpandedCard.jsx';
import {remainingLabel} from './cardExpansion.js';

export const motionAllowed=()=>!window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// R6.1: metadata comes from the store by id (the `metadata` prop is only a fallback for callers without it, e.g. fixtures);
// `metadataPending` is derived from the store, so rails no longer pass metadata or resolved sets.
export const Card=memo(function Card({item:original,instanceId,metadata:fallbackMetadata,open,progress,favorite,toggle,index=0,total=0,preview,pointerPreview,leave,tv,profileId,kids=false}){
 const selected=useCardSelected(instanceId);
 recordCardRender();
 const stored=useMetadataEntry(original.id),metadata=stored.metadata??fallbackMetadata,metadataPending=metadataTracked()&&!stored.resolved;
 const item=useMemo(()=>metadata?{...original,...metadata}:original,[original,metadata]);
 // R6.2/G5b: a stable veil for the memoized image; in TV the category PNG is decoded only when the poster failed or is missing.
 const fallback=useMemo(()=>failed=><ContentIdentity item={item} channel={item.kind==='iptv'} artwork={!tv||failed}/>,[item,tv]);
 const anchor=useRef(),expansion=useRef();
 const sameOwner=node=>node?.closest?.('.card-expansion')?.dataset.cardOwner===instanceId;
 const duration=item.durationSeconds||Number.parseFloat(item.duration)*60;
 const matchup=mlbMatchup(item),guideLine=item.kind==='iptv'&&!item.isEvent?guideNowLine(item.guide):'';
 return <div ref={anchor} className={`card ${selected?'is-previewed':''} ${favorite?'is-favorite':''} ${item.kind==='iptv'?'live-card':'portrait-card'}`} data-content-id={item.id} data-card-id={instanceId} style={{'--card-index':Math.min(index,11)}} onKeyDown={event=>expansion.current?.keyDown(event)} onKeyUp={event=>expansion.current?.keyUp(event)} onMouseEnter={event=>pointerPreview?.(item,event,instanceId)} onMouseMove={event=>{if(tv&&event.nativeEvent.richiflixPointerMoved)pointerPreview?.(item,event,instanceId);}} onMouseLeave={leave} onFocus={event=>{if(event.target.classList.contains('card-open')&&!event.currentTarget.contains(event.relatedTarget)&&!sameOwner(event.relatedTarget))preview?.(item,instanceId,index);}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)&&!sameOwner(event.relatedTarget))leave?.();}}>
  <button className="card-open" aria-label={displayText(item.title)} onClick={()=>open(item)}>
   <div className={`poster ${item.kind==='provider'?'provider-poster':''} ${matchup?'mlb-poster':''}`} style={identityStyle(item)}>
    {item.kind==='iptv'&&<svg className="channel-pattern" viewBox="0 0 400 240" aria-hidden="true"><circle cx="370" cy="10" r="160"/><circle cx="-15" cy="280" r="185"/><path d="M220 -20L440 200M190 -20L410 200"/></svg>}
    {matchup?<MatchupArtwork matchup={matchup}/>:<>
    <QualityImage className={item.kind==='iptv'?'channel-logo':'poster-art'} src={item.imageGeneric?undefined:artworkURL(item.image)} fit={item.kind==='iptv'?'contain':'cover'} minVisibleSize={item.kind==='iptv'?72:0} pending={item.kind!=='iptv'&&metadataPending} priority={selected} fallback={fallback}/></>}
    {item.kind==='iptv'&&<EventBadge item={item} fine={selected}/>}
    {item.kind!=='iptv'&&<UserScore item={item} compact/>}
    {item.kind==='provider'&&<span className="provider-label">{displayText(item.genre)}</span>}
    {!matchup&&<div className="poster-title">{item.kind==='iptv'?channelTitle(item):displayTitle(item)}</div>}
    {!tv&&<div className="card-play">{item.kind==='provider'?<ArrowUpRight className="card-play-icon" size={24}/>:<Play className="card-play-icon" fill="currentColor" size={20}/>}</div>}
    {item.resumeFraction>0?<div className="progress"><i style={{width:`${Math.min(item.resumeFraction*100,100)}%`}}/></div>:progress>0&&duration>0&&<div className="progress"><i style={{width:`${Math.min(progress/duration*100,100)}%`}}/></div>}
   </div>

  </button>
  {!(isTVBuild&&tv)&&<button className="card-save" tabIndex={tv?-1:0} aria-label={`${favorite?'Quitar':'Guardar'} ${displayText(item.title)} ${favorite?'de':'en'} Mi lista`} aria-pressed={favorite} onPointerDown={event=>{if(event.button===0&&event.pointerType==='mouse'){event.preventDefault();event.currentTarget.focus({preventScroll:true});}}} onClick={()=>toggle(item)}>{favorite?<Check size={18}/>:<Heart size={18}/>}</button>}
  <span className="card-caption" aria-hidden="true"><span className="card-title">{displayTitle(item)}</span>{item.resumeLabel&&<span className="card-meta card-resume">{item.resumeLabel}</span>}{item.kind==='iptv'&&<span className={`card-meta category-caption ${guideLine?'has-guide':''}`}><CategoryMark item={item}/>{guideLine?<span className="caption-guide">{displayText(guideLine)}</span>:item.isEvent?eventCaption(item):displayText(item.genre)}</span>}</span>
  {selected&&<SelectedCardExpansion anchor={anchor} controller={expansion} item={item} instanceId={instanceId} metadataPending={metadataPending} favorite={favorite} toggle={toggle} open={open} tv={tv} index={index} total={total} remaining={item.resumeLabel||remainingLabel(progress,duration)} profileId={profileId} kids={kids}/>}
 </div>;
});

export function Carousel({title,items,metadata,open,history,favorites,toggle,more,preview,pointerPreview,leave,selected,tv}){
 const ref=useRef();const id=useId();
 const [position,setPosition]=useState({start:true,end:true,progress:0});
 useEffect(()=>{
  const rail=ref.current;
  const update=()=>{const max=rail.scrollWidth-rail.clientWidth;setPosition({start:rail.scrollLeft<6,end:max<6||rail.scrollLeft>=max-6,progress:max>0?rail.scrollLeft/max:0});};
  const resize=new ResizeObserver(update);resize.observe(rail);rail.addEventListener('scroll',update,{passive:true});update();
  return()=>{resize.disconnect();rail.removeEventListener('scroll',update);};
 },[items.length]);
 const move=direction=>{const rail=ref.current;rail.scrollBy({left:direction*(rail.clientWidth+15),behavior:motionAllowed()?'smooth':'instant'});};
 return <section className="catalog-row" aria-labelledby={id}>
  <div className="row-heading"><h2 id={id}>{displayText(title)}</h2><div className="row-controls"><button className="rail-arrow" aria-label={`Anterior en ${title}`} disabled={position.start} onClick={()=>move(-1)}><ChevronLeft size={20}/></button><button className="rail-arrow" aria-label={`Siguiente en ${title}`} disabled={position.end} onClick={()=>move(1)}><ChevronRight size={20}/></button></div></div>
  <div className="rail-wrap"><div className="cards" ref={ref} aria-label={displayText(title)}>{items.map((item,index)=><Card key={item.id} instanceId={`${id}:${item.id}`} item={item} metadata={metadata?.[item.id]} open={open} progress={history[item.id]} favorite={favorites.includes(item.id)} toggle={toggle} index={index} preview={preview} pointerPreview={pointerPreview} leave={leave} selected={selected===`${id}:${item.id}`} tv={tv}/>)}</div>{!position.end&&<span className="rail-edge" aria-hidden="true"/>}</div>
  <div className="row-footer">{more||<span/>}{(!position.start||!position.end)&&<span className="rail-progress" aria-hidden="true"><i style={{transform:`translateX(${position.progress*200}%)`}}/></span>}</div>
 </section>;
}

export function Hero({items,open,inspect,prepare}){
 const [index,setIndex]=useState(0);
 const base=items[index%items.length],stored=useMetadataEntry(base.id);
 const item=useMemo(()=>stored.metadata?{...base,...stored.metadata}:base,[base,stored.metadata]);
 const metadataPending=['movie','series'].includes(item.mediaType)&&!stored.resolved;
 useEffect(()=>{prepare?.(item,false,true);},[item.id,prepare]);
 const step=direction=>setIndex(prev=>(prev+direction+items.length)%items.length);
 return <section className="hero" aria-label="Destacados">
  <BannerArtwork key={item.id} item={item} variant="hero" metadataPending={metadataPending}/><div className="hero-shade"/>
  <div key={`copy-${item.id}`} className="hero-content"><span className="hero-eyebrow">{displayText(item.contentGenre||item.genre)}</span><h1>{displayTitle(item)}</h1><p className="hero-description">{displayText(item.description)}</p><TitleFacts item={item}/><div className="hero-actions"><button className="primary" onClick={()=>open(item)}><Play size={24} fill="currentColor"/> Reproducir</button><button className="secondary" onClick={()=>inspect(item)}><Info size={24}/> Más información</button></div></div>
  {items.length>1&&<div className="hero-navigation"><div className="hero-dots" role="group" aria-label="Elegir destacado">{items.map((slide,i)=><button key={slide.id} aria-label={`Destacado: ${displayText(slide.title)}`} aria-pressed={index===i} className={index===i?'active':''} onClick={()=>setIndex(i)}><span/></button>)}</div><div className="hero-arrows"><button className="circle" aria-label="Destacado anterior" onClick={()=>step(-1)}><ChevronLeft size={21}/></button><button className="circle" aria-label="Destacado siguiente" onClick={()=>step(1)}><ChevronRight size={21}/></button></div></div>}
 </section>;
}

export function useReveal(ref,version){
 useEffect(()=>{
  if(!motionAllowed())return;
  const elements=[...ref.current.querySelectorAll('.catalog-row,.catalog-grid,.baseball-banner,.empty')];
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:0});
  elements.forEach(element=>{element.classList.add('reveal-ready');observer.observe(element);});
  return()=>{observer.disconnect();elements.forEach(element=>element.classList.remove('reveal-ready'));};
 },[ref,version]);
}
