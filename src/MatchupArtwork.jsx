import React,{useLayoutEffect,useRef,useState} from 'react';
import {QualityImage} from './QualityImage.jsx';
import {scoreLabel} from './mlbSchedule.js';
import {eventPhase} from './liveEvents.js';
import {useGameScore} from './useEventSchedule.js';
import './mlbScore.css';

// Fase L5: Card and ExpandedCard pass only the matchup, so the game comes from the nearest
// `data-content-id` (`event:mlb:<gamePk>`); the banner passes its item. Text only, nothing animates.
export function MatchupArtwork({matchup,wide=false,item}){
 const [first,second]=matchup.teams,root=useRef(),[owner,setOwner]=useState(null);
 useLayoutEffect(()=>{if(!item)setOwner(Number(/^event:mlb:(\d+)$/.exec(root.current?.closest('[data-content-id]')?.dataset.contentId||'')?.[1])||null);});
 const score=useGameScore(item?item.eventOfficialId:owner),label=second&&scoreLabel(score,first.id),live=item?eventPhase(item)==='live':score?.state==='Live'&&!score.stale;
 return <div ref={root} className={`mlb-artwork ${wide?'mlb-wide':''} ${second?'mlb-duel':'mlb-team'} ${label?'has-score':''}`} style={{'--team-first':first.color,'--team-second':(second||first).color}} aria-hidden="true" data-mlb-teams={matchup.teams.map(team=>team.id).join(',')} data-live={live?'':undefined}>
  <div className="mlb-color mlb-color-first"/><div className="mlb-color mlb-color-second"/>
  {second&&<><div className="mlb-divider"/><span className="mlb-versus">VS</span></>}
  <div className="mlb-teams">{matchup.teams.map(team=><div className="mlb-side" key={team.id}>
   <QualityImage className="mlb-mark" src={`${import.meta.env.BASE_URL}artwork/mlb/${team.id}.svg`} fit="contain" eager={wide} fallback={<span className="mlb-abbreviation">{team.abbreviation}</span>}/>
   <span className="mlb-location">{team.name.replace(new RegExp(`\s*${team.id===109?'Diamondbacks':team.teamName}$`),'').trim()}</span>
   <span className="mlb-team-name">{team.teamName}</span>
  </div>)}</div>
  {label&&<div className="mlb-score" data-stale={score.stale?'':undefined}>
   {label.final&&<span className="mlb-inning">Final ·</span>}
   <span className="mlb-runs"><b className={label.first>=label.second?'is-ahead':''}>{label.first}</b> – <b className={label.second>=label.first?'is-ahead':''}>{label.second}</b></span>
   {!label.final&&label.inning&&<span className="mlb-inning">{label.inning}</span>}
  </div>}
 </div>;
}
