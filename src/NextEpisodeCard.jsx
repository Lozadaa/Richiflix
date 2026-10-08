import React,{useEffect,useRef,useState} from 'react';
import {Play} from 'lucide-react';
import {QualityImage} from './QualityImage.jsx';
import {displayText} from './displayText.js';

export const episodeLabel=episode=>[episode.season&&episode.season!=='0'&&`T${episode.season}`,episode.episodeNumber&&`E${episode.episodeNumber}`].filter(Boolean).join(' · ');

// D3: takes the focus when it appears; OK plays, Back dismisses, an arrow hands the focus back to the video.
// The countdown only runs while the video runs (or after it ended) and plays the episode on its own at 0.
export function NextEpisodeCard({episode,secondsLeft=10,running=true,onPlay,onDismiss,onLeave}){
 const button=useRef(),[count,setCount]=useState(secondsLeft);
 useEffect(()=>{button.current?.focus({preventScroll:true});},[]);
 useEffect(()=>{if(!running)return;if(count<=0){onPlay(true);return;}const timer=setTimeout(()=>setCount(value=>value-1),1000);return()=>clearTimeout(timer);},[running,count]);
 const keys=event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onDismiss();}
  else if(event.key.startsWith('Arrow')){event.preventDefault();event.stopPropagation();onLeave();}
 };
 return <section className="player-prompt next-episode-card" aria-label="Siguiente episodio" onKeyDown={keys}>
  <div className="next-episode-art"><QualityImage src={episode.image} fallback={false}/></div>
  <div className="next-episode-copy"><span>Siguiente episodio{episodeLabel(episode)&&` · ${episodeLabel(episode)}`}</span><strong>{displayText(episode.title)}</strong></div>
  <button ref={button} className="primary" aria-label={`Ver siguiente episodio: ${displayText(episode.title)}`} onClick={()=>onPlay(false)}><Play fill="currentColor" size={22}/> {running?`Empieza en ${count}`:'Ver ahora'}</button>
 </section>;
}
