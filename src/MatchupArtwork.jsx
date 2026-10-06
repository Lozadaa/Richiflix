import React from 'react';
import {QualityImage} from './QualityImage.jsx';

export function MatchupArtwork({matchup,wide=false}){
 const [first,second]=matchup.teams;
 return <div className={`mlb-artwork ${wide?'mlb-wide':''} ${second?'mlb-duel':'mlb-team'}`} style={{'--team-first':first.color,'--team-second':(second||first).color}} aria-hidden="true" data-mlb-teams={matchup.teams.map(team=>team.id).join(',')}>
  <div className="mlb-color mlb-color-first"/><div className="mlb-color mlb-color-second"/>
  {second&&<><div className="mlb-divider"/><span className="mlb-versus">VS</span></>}
  <div className="mlb-teams">{matchup.teams.map(team=><div className="mlb-side" key={team.id}>
   <QualityImage className="mlb-mark" src={`${import.meta.env.BASE_URL}artwork/mlb/${team.id}.svg`} fit="contain" eager={wide} fallback={<span className="mlb-abbreviation">{team.abbreviation}</span>}/>
   <span className="mlb-location">{team.name.replace(new RegExp(`\\s*${team.id===109?'Diamondbacks':team.teamName}$`),'').trim()}</span>
   <span className="mlb-team-name">{team.teamName}</span>
  </div>)}</div>
 </div>;
}
