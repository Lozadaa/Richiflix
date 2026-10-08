import React,{forwardRef,memo,useCallback,useEffect,useImperativeHandle,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {Play,Check} from 'lucide-react';
import {QualityImage} from './QualityImage.jsx';
import {displayText} from './displayText.js';
import {sameIndices} from './virtualWindow.js';
import {episodePositions,episodeWindow} from './episodeWindow.js';
import {glideViewportBy,cancelViewportGlide,viewportRevealDelta} from './virtualViewport.js';
import {createCardPress} from './cardExpansion.js';
import {episodeState} from './watchProgress.js';

// D5: watched (check, dimmed title), started (bar + «Quedan 12 min») and next to watch (highlighted, initial focus).
// Holding OK opens «Marcar como visto / no visto» and «Marcar temporada como vista» in the row.
const Episode=memo(function Episode({episode,index,top,height,headingHeight,state,remaining,fraction,isNext,seasonWatched,menu,seasonDone,mark,play}){
 return <div className={`episode-cell ${state==='watched'?'is-watched':''} ${isNext?'is-next':''}`} data-episode-index={index} style={{top,height:height+(episode.groupStart?headingHeight:0)}}>
 {episode.groupStart&&<div className="episode-season-heading" style={{height:headingHeight}}><h4>{episode.season==='0'?'Especiales':`Temporada ${displayText(episode.season)}`}</h4><span>{seasonWatched===episode.groupCount&&<Check className="season-done" aria-hidden="true"/>}{seasonWatched>0?`${seasonWatched} de ${episode.groupCount} vistos`:`${episode.groupCount} ${episode.groupCount===1?'episodio':'episodios'}`}</span></div>}
 <button className="episode-button" style={{height}} data-episode-id={episode.id} data-season={episode.season} aria-label={`Reproducir ${displayText(episode.title)}`} onClick={()=>play(episode)}>
  <div className="episode-art"><QualityImage src={episode.image} loader fallback={false}/>{state==='started'&&fraction>0&&<span className="episode-progress" aria-hidden="true"><i style={{width:`${fraction*100}%`}}/></span>}{state==='watched'&&<span className="episode-watched" aria-label="Visto"><Check aria-hidden="true"/></span>}</div>
  <div className="episode-copy"><div className="episode-title"><span className="episode-number">{episode.episodeNumber||index+1}</span><strong>{displayText(episode.title)}</strong></div>{episode.description&&<p>{displayText(episode.description)}</p>}{(episode.duration||episode.descriptionLanguage==='en'||remaining>0||isNext)&&<small>{[isNext&&'Siguiente por ver',remaining>0&&`Quedan ${remaining} min`,!remaining&&episode.duration&&displayText(episode.duration),episode.descriptionLanguage==='en'&&'Sinopsis en inglés'].filter(Boolean).join(' · ')}</small>}</div>
  <span className="episode-play" aria-hidden="true"><Play fill="currentColor"/></span>
 </button>
 {menu&&<div className="episode-menu" role="group" aria-label={`Opciones de ${displayText(episode.title)}`}><button className="secondary" onClick={()=>mark(index,'episode')}>{state==='watched'?'Marcar como no visto':'Marcar como visto'}</button><button className="secondary" onClick={()=>mark(index,'season')}>{seasonDone?'Marcar temporada como no vista':'Marcar temporada como vista'}</button></div>}
 </div>;
});

export const EpisodeList=forwardRef(function EpisodeList({episodes,history={},watched={},durations={},nextId,onMark,play,returnSummary,remember},ref){
 const viewport=useRef(),snapshot=useRef(),focused=useRef(-1),frame=useRef();
 const [layout,setLayout]=useState({height:600,rowHeight:164,headingHeight:64}),[indices,setIndices]=useState(()=>episodeWindow({offsets:episodePositions(episodes,164,64),height:600}));
 const offsets=useMemo(()=>episodePositions(episodes,layout.rowHeight,layout.headingHeight),[episodes,layout.rowHeight,layout.headingHeight]);
 const [menu,setMenu]=useState(-1),pressed=useRef(-1),press=useRef();
 const statuses=useMemo(()=>episodes.map(episode=>episodeState({episodeId:episode.id,history,watched,durations},episode.durationSeconds)),[episodes,history,watched,durations]);
 const seasons=useMemo(()=>{const counts=new Map();episodes.forEach((episode,index)=>counts.set(episode.season,(counts.get(episode.season)||0)+(statuses[index].state==='watched'?1:0)));return counts;},[episodes,statuses]);
 snapshot.current={episodes,layout,indices,offsets,statuses,play,onMark};
 press.current??=createCardPress({short:()=>{const episode=snapshot.current.episodes[pressed.current];if(episode)snapshot.current.play(episode);},long:()=>setMenu(pressed.current)});
 const closeMenu=index=>{setMenu(-1);requestAnimationFrame(()=>viewport.current?.querySelector(`[data-episode-index="${index}"] .episode-button`)?.focus({preventScroll:true}));};
 const mark=useCallback((index,kind)=>{
  const {episodes,statuses,onMark}=snapshot.current,episode=episodes[index],group=kind==='season'?episodes.flatMap((entry,at)=>entry.season===episode.season?[at]:[]):[index];
  onMark?.(group.map(at=>episodes[at].id),kind==='season'?!group.every(at=>statuses[at].state==='watched'):statuses[index].state!=='watched');closeMenu(index);
 },[]);
 useEffect(()=>{if(menu>=0)viewport.current?.querySelector('.episode-menu button')?.focus({preventScroll:true});},[menu]);
 useEffect(()=>()=>press.current?.cancel(),[]);
 const refresh=()=>{const view=viewport.current,{offsets}=snapshot.current;const next=episodeWindow({offsets,offset:view.scrollTop,height:view.clientHeight,focusedIndex:focused.current});setIndices(previous=>sameIndices(previous,next)?previous:next);};
 const focus=index=>{
  const view=viewport.current,{episodes,layout,offsets}=snapshot.current;if(index<0||index>=episodes.length)return;
  focused.current=index;
  const next=episodeWindow({offsets,offset:view.scrollTop,height:view.clientHeight,focusedIndex:index});
  if(!sameIndices(snapshot.current.indices,next))flushSync(()=>setIndices(next));
  view.querySelector(`[data-episode-index="${index}"] .episode-button`)?.focus({preventScroll:true});
  const top=offsets[index],bottom=offsets[index+1]-12;
  glideViewportBy(view,viewportRevealDelta({top,bottom,viewportTop:view.scrollTop,height:view.clientHeight,margin:12}));
 };
 useImperativeHandle(ref,()=>({focus,focusId:id=>focus(Math.max(0,snapshot.current.episodes.findIndex(episode=>episode.id===id)))}));
 useLayoutEffect(()=>{
  const view=viewport.current;
  const measure=()=>{const style=getComputedStyle(view),rowHeight=parseFloat(style.getPropertyValue('--episode-row-height'))||164,headingHeight=parseFloat(style.getPropertyValue('--episode-heading-height'))||64;setLayout(previous=>previous.height===view.clientHeight&&previous.rowHeight===rowHeight&&previous.headingHeight===headingHeight?previous:{height:view.clientHeight,rowHeight,headingHeight});};
  measure();const observer=new ResizeObserver(measure);observer.observe(view);
  const scroll=()=>{if(frame.current)return;frame.current=requestAnimationFrame(()=>{frame.current=null;refresh();});};
  view.addEventListener('scroll',scroll,{passive:true});
  return()=>{observer.disconnect();view.removeEventListener('scroll',scroll);cancelAnimationFrame(frame.current);cancelViewportGlide(view);};
 },[]);
 useEffect(refresh,[layout,episodes]);
 const navigate=event=>{
  const cell=event.target.closest('[data-episode-index]');if(!cell)return;const current=Number(cell.dataset.episodeIndex);
  if(event.target.closest('.episode-menu')){
   if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();const buttons=[...cell.querySelectorAll('.episode-menu button')];buttons[(buttons.indexOf(event.target)+1)%buttons.length]?.focus({preventScroll:true});}
   else if(event.key==='Escape'||event.key.startsWith('Arrow')){event.preventDefault();event.stopPropagation();closeMenu(current);}
   return;
  }
  if(event.key==='Enter'&&event.target.matches('.episode-button')){event.preventDefault();if(!event.repeat){pressed.current=current;press.current.down();}return;}
  if(!event.key.startsWith('Arrow'))return;
  event.preventDefault();event.stopPropagation();
  if(event.key==='ArrowLeft'||event.key==='ArrowUp'&&current===0){returnSummary(event.key==='ArrowUp');return;}
  if(event.key==='ArrowDown')focus(current+1);else if(event.key==='ArrowUp')focus(current-1);
 };
 return <div className="episode-window" ref={viewport} onKeyDownCapture={navigate} onKeyUpCapture={event=>{if((event.key==='Enter'||event.keyCode===13)&&press.current.pressed){event.preventDefault();press.current.up();}}} onBlurCapture={event=>{if(event.target.matches('.episode-button'))press.current.cancel();}} onFocusCapture={event=>{const cell=event.target.closest('[data-episode-index]');if(!cell)return;const index=Number(cell.dataset.episodeIndex);if(episodes[index]){focused.current=index;remember(episodes[index]);}}}>
  <div className="episode-track" style={{height:Math.max(0,offsets.at(-1)-12)}}>{indices.filter(index=>index<episodes.length).map(index=><Episode key={`${episodes[index].season}:${episodes[index].id}`} episode={episodes[index]} index={index} top={offsets[index]} height={layout.rowHeight-12} headingHeight={layout.headingHeight} state={statuses[index].state} remaining={statuses[index].remainingMinutes} fraction={statuses[index].fraction} isNext={episodes[index].id===nextId} seasonWatched={seasons.get(episodes[index].season)} menu={menu===index} seasonDone={seasons.get(episodes[index].season)===episodes[index].groupCount} mark={mark} play={play}/>)}</div>
 </div>;
});
