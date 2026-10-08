import React,{useRef} from 'react';
import {Check,Heart} from 'lucide-react';
import {Dialog} from './Dialog.jsx';
import {BannerArtwork} from './BannerArtwork.jsx';
import {SeriesEpisodes} from './SeriesEpisodes.jsx';
import {TitleFacts} from './UserScore.jsx';
import {displayTitle} from './artwork.js';
import {displayText} from './displayText.js';

export function SeriesDetail({item,close,play,favorite,toggle,history,progress,selection,tv}){
 const episodes=useRef(),summary=useRef();
 const returnSummary=back=>summary.current.closest('[role="dialog"]').querySelector(back?'.dialog-close':'.series-save')?.focus({preventScroll:true});
 const navigate=event=>{if(event.key==='ArrowDown'&&event.target.closest('.dialog-close')||event.key==='ArrowRight'&&event.target.closest('.series-save')){event.preventDefault();event.stopPropagation();episodes.current?.focusCurrent();}else if(event.key==='ArrowUp'&&event.target.closest('.series-save')){event.preventDefault();event.stopPropagation();returnSummary(true);}};
 return <Dialog immersive className={`series-detail ${tv?'series-tv':''}`} label={displayTitle(item)} close={close} onKeyDownCapture={navigate}>
  <div className="series-artwork" aria-hidden="true"><BannerArtwork item={item} variant="hero"/></div><div className="series-atmosphere"/>
  <div className="series-detail-layout"><aside ref={summary} className="series-summary"><h2>{displayTitle(item)}</h2><p className="series-description">{displayText(item.description||item.contentGenre||item.genre)}</p><TitleFacts item={item}/><button className={`secondary series-save ${favorite?'saved':''}`} aria-label={favorite?'Quitar de Mi lista':'Guardar en Mi lista'} aria-pressed={favorite} onClick={()=>toggle(item)}>{favorite?<Check/>:<Heart/>}</button></aside>
   <SeriesEpisodes ref={episodes} key={item.id} item={item} history={history} progress={progress} initialSeason={selection?.season} initialEpisodeId={selection?.episodeId} returnSummary={returnSummary} play={play}/>
  </div>
 </Dialog>;
}
