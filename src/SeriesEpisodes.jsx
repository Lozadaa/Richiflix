import React,{forwardRef,useEffect,useImperativeHandle,useMemo,useRef,useState} from 'react';
import {RefreshCw,Clapperboard} from 'lucide-react';
import {xtreamClient} from './xtreamClient.js';
import {EpisodeList} from './EpisodeList.jsx';
import {useSeasonMetadata} from './useSeasonMetadata.js';
import {mergeSeasonEpisodes} from './episodeMetadata.js';
import {nextToWatch} from './watchProgress.js';
import './seriesEpisodes.css';

export const SeriesEpisodes=forwardRef(function SeriesEpisodes({item,play,history={},progress={},initialSeason,initialEpisodeId,returnSummary},ref){
 const {watched={},durations={},recent={},onMark}=progress;
 const [groups,setGroups]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const root=useRef(),list=useRef(),lastEpisode=useRef(initialEpisodeId),interacted=useRef(false);
 const seasons=useMemo(()=>groups.map(group=>group.season),[groups]),{bySeason}=useSeasonMetadata(item,seasons,initialSeason??seasons[0]);
 const seasonEpisodes=useMemo(()=>groups.map(group=>({season:group.season,episodes:mergeSeasonEpisodes(group.episodes,bySeason.get(group.season),{season:group.season}).map(episode=>({...episode,season:group.season}))})),[groups,bySeason]);
 const episodes=useMemo(()=>seasonEpisodes.flatMap(group=>group.episodes.map((episode,index)=>({...episode,groupStart:index===0,groupCount:group.episodes.length}))),[seasonEpisodes]);
 // D5: the next episode to watch is highlighted and takes the initial focus when nothing else was chosen.
 const next=useMemo(()=>nextToWatch(episodes,{history,watched,durations,recentId:recent[item.id]?.episodeId}),[episodes,history,watched,durations,recent,item.id]);
 useImperativeHandle(ref,()=>({focusCurrent:()=>list.current?.focusId(lastEpisode.current)}));
 useEffect(()=>{let active=true;setLoading(true);setError('');xtreamClient().episodes(item.streamId,item.sourceId).then(data=>{if(active){setGroups(data);setLoading(false);}}).catch(()=>{if(active){setError('No se pudieron cargar los episodios. Comprueba la conexión y vuelve a intentarlo.');setLoading(false);}});return()=>{active=false;};},[item.streamId,item.sourceId,retry]);
 useEffect(()=>{if(loading||error||interacted.current)return;const frame=requestAnimationFrame(()=>{const active=document.activeElement,dialog=root.current?.closest('[role="dialog"]');if(!dialog||!dialog.contains(active))return;list.current?.focusId(initialEpisodeId||(initialSeason==null?next?.id:episodes.find(episode=>episode.season===initialSeason)?.id));});return()=>cancelAnimationFrame(frame);},[loading,error]);
 return <section ref={root} className="series-episodes" aria-label="Episodios" onKeyDownCapture={()=>{interacted.current=true;}} onPointerDownCapture={()=>{interacted.current=true;}}>
  <div className="series-browser-heading"><h3>Episodios</h3><span>{!loading&&!error&&`${episodes.length} ${episodes.length===1?'episodio':'episodios'}`}</span></div>
  {loading&&<div className="episodes-loading" role="status" aria-label="Cargando episodios"><span className="focus-info-loader"/><p>Cargando episodios…</p><div className="episode-skeleton"/><div className="episode-skeleton"/><div className="episode-skeleton"/></div>}
  {error&&<div className="episodes-empty"><p role="alert">{error}</p><button className="secondary" onClick={()=>{interacted.current=false;setRetry(value=>value+1);}}><RefreshCw/> Reintentar</button></div>}
  {!loading&&!error&&(episodes.length?<EpisodeList ref={list} episodes={episodes} history={history} watched={watched} durations={durations} nextId={next?.id} onMark={onMark} play={episode=>play(episode,{season:episode.season,episodeId:episode.id,seasons:seasonEpisodes})} returnSummary={returnSummary} remember={episode=>{lastEpisode.current=episode.id;}}/>:<div className="episodes-empty"><Clapperboard aria-hidden="true"/><h4>Sin episodios disponibles</h4><p>El proveedor no tiene episodios disponibles para esta serie.</p></div>)}
 </section>;
});
