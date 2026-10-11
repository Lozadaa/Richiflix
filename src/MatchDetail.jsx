import React,{useContext,useEffect,useMemo,useState} from 'react';
import {MatchDetailContext} from './matchContext.js';
import {Play,RotateCw,ArrowLeftRight} from 'lucide-react';
import {Dialog} from './Dialog.jsx';
import {SUMMARY_URL,kickOff,dayLabel} from './leagueStats.js';
import {parseSummary,phaseLabel} from './matchDetail.js';
import {competitionLabel,footballMatchup} from './footballArtwork.js';
import {eventInstant} from './eventTime.js';
import {FollowContext} from './ExpandedCard.jsx';
import {teamLabel} from './followedTeams.js';
import './matchDetail.css';

// «Detalle del partido»: opened from a fixture of the league panel or from a football event's panel. The header shows at
// once from what the caller already knows (`fallback`), the summary fills in after; live matches refresh every 30 s.
// `events` are the football IPTV events, so «Ver en vivo» appears when the provider carries the match.
const Crest=({team,size})=><span className={`match-crest ${size||''}`} aria-hidden="true">{team.logo?<img src={import.meta.env.BASE_URL+team.logo} alt="" decoding="async"/>:<b>{(team.abbreviation||team.name||'').slice(0,3)}</b>}</span>;
const KIND={goal:'Gol',own:'Gol en contra',penalty:'Gol de penal',yellow:'Tarjeta amarilla',red:'Tarjeta roja',sub:'Cambio'};
function Mark({kind}){
 if(kind==='yellow'||kind==='red')return <i className={`match-card ${kind}`} aria-hidden="true"/>;
 if(kind==='sub')return <ArrowLeftRight className="match-sub" aria-hidden="true"/>;
 return <svg className={`match-ball ${kind}`} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z"/></svg>;
}
async function summary(slug,id,signal){const response=await fetch(SUMMARY_URL(slug,id),{signal});if(!response.ok)throw Error('Summary unavailable');return parseSummary(await response.json());}
function useSummary(slug,id,attempt){
 const [state,setState]=useState({status:'loading',match:null});
 useEffect(()=>{
  let disposed=false,controller,timer;
  const load=async()=>{
   controller=new AbortController();const abort=setTimeout(()=>controller.abort(),12000);
   try{const match=await summary(slug,id,controller.signal);if(disposed)return;setState({status:match?'ready':'error',match});if(match?.state==='live')timer=setTimeout(load,30000);}
   catch{if(!disposed)setState(previous=>({status:previous.match?'ready':'error',match:previous.match}));}
   finally{clearTimeout(abort);}
  };
  setState({status:'loading',match:null});load();
  return()=>{disposed=true;controller?.abort();clearTimeout(timer);};
 },[slug,id,attempt]);
 return state;
}
// The IPTV event of this match: same official id, or the same two teams within half a day.
export function iptvEventFor(events,{id,date,home,away}){
 const official=events.find(event=>event.eventOfficialId===`futbol:${id}`);if(official||!home||!away)return official||null;
 return events.find(event=>{const ids=footballMatchup(event)?.teams.map(team=>team.id)||[],start=eventInstant(event.eventStartsAt);return ids.includes(home.id)&&ids.includes(away.id)&&(start===null||Math.abs(start-date)<12*3600000);})||null;
}
function Timeline({match}){
 // Goals and cards; substitutions live in the line-ups («Entraron»), so the column fits one TV screen.
 const events=match.events.filter(event=>event.kind!=='sub');
 if(!events.length)return <p className="match-note">{match.state==='pre'?'El minuto a minuto aparece cuando empieza el partido.':'Sin goles ni tarjetas.'}</p>;
 return <ol className="match-timeline">{events.map(event=><li key={event.id} className={`is-${event.side} kind-${event.kind}`}>
  <span className="match-minute">{event.minute||''}</span>
  <span className="match-event"><Mark kind={event.kind}/><span><b>{event.player}</b>{event.kind==='sub'&&event.other?<small>Sale {event.other}</small>:event.other&&['goal','penalty'].includes(event.kind)?<small>Asistencia de {event.other}</small>:<small>{KIND[event.kind]}</small>}</span></span>
 </li>)}</ol>;
}
function Stats({match}){
 if(!match.stats.length)return <p className="match-note">Las estadísticas aparecen con el partido en juego.</p>;
 return <ul className="match-stats">{match.stats.map(stat=>{const total=stat.home+stat.away||1,share=stat.name==='possessionPct'?stat.home/100:stat.home/total;return <li key={stat.name}>
  <span className={stat.home>stat.away?'is-ahead':''}>{stat.home}{stat.unit}</span><span className="match-stat-label">{stat.label}</span><span className={stat.away>stat.home?'is-ahead':''}>{stat.away}{stat.unit}</span>
  <i className="match-stat-bar" aria-hidden="true"><b style={{transform:`scaleX(${Math.max(0,Math.min(1,share))})`}}/></i>
 </li>;})}</ul>;
}
function Lineups({match}){
 const {home,away}=match.lineups;if(!home&&!away)return <p className="match-note">Las alineaciones se publican cerca del inicio.</p>;
 const column=(team,lineup)=><div className="match-lineup"><h4><Crest team={team} size="small"/>{team.name}{lineup?.formation&&<span>{lineup.formation}</span>}</h4>
  <ol>{(lineup?.starters||[]).map(player=><li key={player.jersey+player.name} className={player.out?'is-out':''}><span>{player.jersey}</span>{player.name}<small>{player.position}</small></li>)}</ol>
  {lineup?.bench.length>0&&<p className="match-bench">Entraron: {lineup.bench.map(player=>player.name).join(', ')}</p>}</div>;
 return <div className="match-lineups">{column(match.home,home)}{column(match.away,away)}</div>;
}
export function MatchDetail({match:request,close,play}){
 const {events}=useContext(MatchDetailContext),follow=useContext(FollowContext),
 [retry,setRetry]=useState(0),{status,match:loaded}=useSummary(request.slug,request.id,retry);
 const match=loaded||request.fallback||null,live=match?.state==='live';
 const iptv=useMemo(()=>match?iptvEventFor(events||[],{id:request.id,date:match.date,home:match.home,away:match.away}):null,[events,match,request.id]);
 const competition=competitionLabel(request.slug),title=match?`${match.home.name} vs. ${match.away.name}`:'Detalle del partido';
 // Before kick-off the big clock shows the time and the pill the day («Hoy», «sáb 18 oct»).
 const phase=match?match.state==='pre'?dayLabel(match.date):phaseLabel(match,kickOff):'';
 return <Dialog label={`Detalle: ${title}`} close={close} className="match-dialog">
  <header className="match-head" data-state={match?.state}>
   <p className="match-meta">{[competition,request.round,match?.venue].filter(Boolean).join(' · ')}</p>
   {match?<div className="match-score">
    <div className="match-side"><Crest team={match.home} size="large"/><b>{match.home.name}</b></div>
    <div className="match-center">{match.state==='pre'||match.home.score===null?<span className="match-time">{kickOff(match.date)}</span>:<span className="match-goals"><b className={match.home.score>match.away.score?'is-ahead':''}>{match.home.score}</b>–<b className={match.away.score>match.home.score?'is-ahead':''}>{match.away.score}</b></span>}
     <span className={`match-phase ${live?'is-live':''}`}>{live&&<i aria-hidden="true"/>}{phase}</span></div>
    <div className="match-side"><Crest team={match.away} size="large"/><b>{match.away.name}</b></div>
   </div>:<div className="match-score match-skeleton" aria-hidden="true"><i/><i/><i/></div>}
   <div className="match-actions">
    {iptv&&<button className="match-watch" onClick={()=>{close();play(iptv);}}><Play fill="currentColor" aria-hidden="true"/>{live?'Ver en vivo':'Ver señal'}</button>}
    {follow.toggleTeam&&match&&[match.home,match.away].map(team=>{const followed=follow.teams.includes(team.id);return <button key={team.id} className="match-follow" aria-pressed={followed} onClick={()=>follow.toggleTeam(team.id)}>{followed?'Siguiendo':'Seguir'} · {teamLabel(team.id)||team.name}</button>;})}
   </div>
  </header>
  {status==='error'&&!loaded?<div className="match-error" role="alert"><p>No pudimos cargar el detalle. Revisa tu conexión.</p><button className="match-retry" onClick={()=>setRetry(value=>value+1)}><RotateCw aria-hidden="true"/>Reintentar</button></div>
  :status==='loading'&&!loaded?<div className="match-body match-skeleton-body" aria-hidden="true"><div/><div/><div/></div>
  :loaded&&<div className="match-body match-reveal">
   <section aria-label="Goles y tarjetas"><h3>Goles y tarjetas</h3><Timeline match={loaded}/></section>
   <section aria-label="Estadísticas"><h3>Estadísticas</h3><Stats match={loaded}/></section>
   <section aria-label="Alineaciones"><h3>Alineaciones</h3><Lineups match={loaded}/></section>
  </div>}
 </Dialog>;
}
