import React,{memo,useState} from 'react';
import {Play,Heart,Check,Clock3} from 'lucide-react';
import {identityStyle,channelTitle} from './ContentIdentity.jsx';
import {displayTitle} from './artwork.js';
import {BannerArtwork} from './BannerArtwork.jsx';
import {TrailerPreview} from './TrailerPreview.jsx';
import {mlbMatchup} from './mlbArtwork.js';
import {displayText} from './displayText.js';
import {CategoryMark} from './CategoryMark.jsx';
import {useEventCountdown} from './EventBadge.jsx';
import {eventStartLabel} from './eventTime.js';
import {isTVBuild} from './platform.js';
import {TitleFacts} from './UserScore.jsx';
export const FocusStage=memo(function FocusStage({item,active,loading=false,metadataPending=loading,collapsed=false,moving=false,open,inspect,favorite,toggle,tv,hover,leave,previewPlaying=true}){
 const [actionsFocused,setActionsFocused]=useState(false);
 const event=useEventCountdown(item);
 if(!item)return null;const live=item.kind==='iptv',matchup=mlbMatchup(item),upcoming=event?.state==='upcoming',remoteActions=isTVBuild&&tv;
 return <section className={`hero focus-stage ${tv?'tv-stage':'pointer-stage'} ${live?'channel-stage':''} ${matchup?'mlb-stage':''}`} data-content-id={item.id} data-stage-state={moving?'browsing':collapsed?'hidden':'settled'} inert={tv&&!previewPlaying} aria-label="Vista del título seleccionado" style={identityStyle(item)} onMouseEnter={hover} onMouseLeave={leave} onFocus={event=>{if(remoteActions)setActionsFocused(true);hover?.(event);}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)){setActionsFocused(false);leave?.();}}}>
  {<TrailerPreview id={live?undefined:item.trailerId} active={!live&&active&&!collapsed}/>}
  <BannerArtwork key={item.id} item={item} metadataPending={metadataPending}/>
  <div className="focus-stage-shade"/>
  <div className="focus-stage-copy">
   <span className="focus-eyebrow"><CategoryMark item={item}/>{displayText(live?[item.eventScheduleState==='postponed'?'APLAZADO':upcoming?'PRÓXIMAMENTE':event?'EVENTO PROGRAMADO':'EN VIVO',eventStartLabel(item),item.genre].filter(Boolean).join(' · '):item.contentGenre||item.genre)}{loading&&<span className="focus-info-loader" role="status" aria-label="Cargando información"/>}</span>
   <h1>{live?channelTitle(item):displayTitle(item)}</h1>
   <p className={`focus-description ${upcoming?'focus-countdown':''}`}>{upcoming?<><Clock3 aria-hidden="true"/>{event.label}</>:displayText(item.description|| (live?`${item.source} · Televisión en directo`:item.genre))}</p>
   <TitleFacts item={item}/>
   {item.cast&&<p className="focus-cast">{displayText(item.cast)}</p>}
   <div className="focus-actions" role="group" aria-label="Acciones del título seleccionado" aria-hidden={remoteActions&&!actionsFocused?true:undefined}><button className="primary" tabIndex={remoteActions&&!actionsFocused?-1:undefined} aria-label={item.mediaType==='series'?'Ver episodios':'Reproducir'} onClick={()=>item.mediaType==='series'?inspect(item):open(item)}><Play fill="currentColor" aria-hidden="true"/></button><button className="secondary" tabIndex={remoteActions&&!actionsFocused?-1:undefined} aria-label={favorite?'Quitar de Mi lista':'Guardar en Mi lista'} aria-pressed={favorite} onClick={()=>toggle(item)}>{favorite?<Check aria-hidden="true"/>:<Heart aria-hidden="true"/>}</button></div>
  </div>
 </section>;
});
