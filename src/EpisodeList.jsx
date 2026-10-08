import React,{forwardRef,memo,useEffect,useImperativeHandle,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {Play} from 'lucide-react';
import {QualityImage} from './QualityImage.jsx';
import {displayText} from './displayText.js';
import {sameIndices} from './virtualWindow.js';
import {episodePositions,episodeWindow} from './episodeWindow.js';
import {glideViewportBy,cancelViewportGlide,viewportRevealDelta} from './virtualViewport.js';

const Episode=memo(function Episode({episode,index,top,height,headingHeight,progress,play}){
 const fraction=episode.durationSeconds>0?Math.min(1,Math.max(0,(progress||0)/episode.durationSeconds)):0;
 return <div className="episode-cell" data-episode-index={index} style={{top,height:height+(episode.groupStart?headingHeight:0)}}>
 {episode.groupStart&&<div className="episode-season-heading" style={{height:headingHeight}}><h4>{episode.season==='0'?'Especiales':`Temporada ${displayText(episode.season)}`}</h4><span>{episode.groupCount} {episode.groupCount===1?'episodio':'episodios'}</span></div>}
 <button className="episode-button" style={{height}} data-episode-id={episode.id} data-season={episode.season} aria-label={`Reproducir ${displayText(episode.title)}`} onClick={()=>play(episode)}>
  <div className="episode-art"><QualityImage src={episode.image} loader fallback={false}/>{fraction>0&&<span className="episode-progress" aria-hidden="true"><i style={{width:`${fraction*100}%`}}/></span>}</div>
  <div className="episode-copy"><div className="episode-title"><span className="episode-number">{episode.episodeNumber||index+1}</span><strong>{displayText(episode.title)}</strong></div>{episode.description&&<p>{displayText(episode.description)}</p>}{(episode.duration||episode.descriptionLanguage==='en')&&<small>{[episode.duration&&displayText(episode.duration),episode.descriptionLanguage==='en'&&'Sinopsis en inglés'].filter(Boolean).join(' · ')}</small>}</div>
  <span className="episode-play" aria-hidden="true"><Play fill="currentColor"/></span>
 </button></div>;
});

export const EpisodeList=forwardRef(function EpisodeList({episodes,history={},play,returnSummary,remember},ref){
 const viewport=useRef(),snapshot=useRef(),focused=useRef(-1),frame=useRef();
 const [layout,setLayout]=useState({height:600,rowHeight:164,headingHeight:64}),[indices,setIndices]=useState(()=>episodeWindow({offsets:episodePositions(episodes,164,64),height:600}));
 const offsets=useMemo(()=>episodePositions(episodes,layout.rowHeight,layout.headingHeight),[episodes,layout.rowHeight,layout.headingHeight]);
 snapshot.current={episodes,layout,indices,offsets};
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
  const cell=event.target.closest('[data-episode-index]');if(!cell||!event.key.startsWith('Arrow'))return;const current=Number(cell.dataset.episodeIndex);
  event.preventDefault();event.stopPropagation();
  if(event.key==='ArrowLeft'||event.key==='ArrowUp'&&current===0){returnSummary(event.key==='ArrowUp');return;}
  if(event.key==='ArrowDown')focus(current+1);else if(event.key==='ArrowUp')focus(current-1);
 };
 return <div className="episode-window" ref={viewport} onKeyDownCapture={navigate} onFocusCapture={event=>{const cell=event.target.closest('[data-episode-index]');if(!cell)return;const index=Number(cell.dataset.episodeIndex);if(episodes[index]){focused.current=index;remember(episodes[index]);}}}>
  <div className="episode-track" style={{height:Math.max(0,offsets.at(-1)-12)}}>{indices.filter(index=>index<episodes.length).map(index=><Episode key={`${episodes[index].season}:${episodes[index].id}`} episode={episodes[index]} index={index} top={offsets[index]} height={layout.rowHeight-12} headingHeight={layout.headingHeight} progress={history[episodes[index].id]} play={play}/>)}</div>
 </div>;
});
