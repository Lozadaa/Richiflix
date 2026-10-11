import React,{memo,useContext,useMemo,useState} from 'react';
import {RotateCw,Tv} from 'lucide-react';
import {useLeagueStats} from './useLeagueStats.js';
import {recentForm,fixtureDays,kickOff} from './leagueStats.js';
import {competitionByLabel} from './footballArtwork.js';
import {phaseLabel} from './matchDetail.js';
import {MatchDetailContext} from './matchContext.js';
import {iptvEventFor} from './MatchDetail.jsx';
import {FollowContext} from './ExpandedCard.jsx';
import './leagueStats.css';

// «Fútbol» page, one competition chip selected: its table (groups, recent form, live scores, followed teams) beside the
// month's fixtures and the top scorers and assists, even on days without matches. While loading, a skeleton with the
// final geometry holds the space; data fades in once. Tabs are a segmented control whose pill slides; switching never
// scrolls. Every button inside takes part in the remote's spatial walk (useRemoteNavigation, `.league-stats`).
const time=value=>new Date(value).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const Crest=({club})=><span className="league-crest" aria-hidden="true">{club.logo?<img src={import.meta.env.BASE_URL+club.logo} alt="" decoding="async"/>:<b>{(club.abbreviation||club.name||'').slice(0,3)}</b>}</span>;
const signed=value=>value===null?'':value>0?`+${value}`:String(value);
const FORM={G:'Ganado',E:'Empate',P:'Perdido'};
const HEAD=<div className="league-table-row league-table-head" role="row"><span role="columnheader">#</span><span role="columnheader">Club</span><span role="columnheader" title="Partidos jugados">PJ</span><span role="columnheader" title="Ganados">G</span><span role="columnheader" title="Empatados">E</span><span role="columnheader" title="Perdidos">P</span><span role="columnheader" title="Goles a favor y en contra">Goles</span><span role="columnheader" title="Diferencia de gol">DG</span><span role="columnheader" title="Puntos">Pts</span><span role="columnheader" className="league-form-head" title="Últimos partidos, hasta cinco">Forma</span></div>;
function Standings({rows,zones,form,live,followed}){
 return <div className="league-table league-reveal" role="table" aria-label="Tabla de posiciones">
  {HEAD}
  {rows.map(row=>{const playing=live.get(row.id),results=form.get(row.id)||[];return <div className={`league-table-row ${followed.has(row.id)?'is-followed':''}`} role="row" key={row.id} style={row.zone?{'--zone':row.zone.color}:undefined} data-zone={row.zone?'':undefined}>
   <span role="cell" className="league-rank">{row.rank}</span>
   <span role="cell" className="league-club"><Crest club={row}/><span>{row.name}</span>{playing&&<em className="league-live" title="En juego">{playing}</em>}</span>
   <span role="cell">{row.played??''}</span><span role="cell">{row.wins??''}</span><span role="cell">{row.draws??''}</span><span role="cell">{row.losses??''}</span>
   <span role="cell" className="league-goals">{row.goalsFor??''}:{row.goalsAgainst??''}</span><span role="cell">{signed(row.difference)}</span>
   <span role="cell" className="league-points">{row.points??''}</span>
   <span role="cell" className="league-form" aria-label={results.length?`Últimos: ${results.map(result=>FORM[result]).join(', ')}`:'Sin partidos recientes'}>{results.map((result,index)=><i key={index} data-result={result}>{result}</i>)}</span>
  </div>;})}
  {zones.length>0&&<ul className="league-zones" aria-label="Zonas de la tabla">{zones.map(zone=><li key={zone.label} style={{'--zone':zone.color}}>{zone.label}</li>)}</ul>}
 </div>;
}
function Leaders({list,unit,followed}){
 if(!list.length)return <p className="league-note league-reveal">ESPN todavía no publica esta lista.</p>;
 return <ol className="league-leaders league-reveal">{list.map(player=><li key={player.id} className={followed.has(player.club.id)?'is-followed':''}>
  <span className="league-rank">{player.rank}</span>
  <span className="league-player"><b>{player.name}</b><span><Crest club={player.club}/>{player.club.name}{player.matches!==null?` · ${player.matches} PJ`:''}</span></span>
  <span className="league-value" aria-label={`${player.value} ${unit}`}>{player.value}</span>
 </li>)}</ol>;
}
function Fixtures({fixtures,events,followed,open}){
 const days=useMemo(()=>fixtureDays(fixtures),[fixtures]);
 if(!days.length)return <p className="league-note league-reveal">Sin partidos programados este mes.</p>;
 return <div className="league-fixtures league-reveal">{days.map(day=><section key={day.key} aria-label={day.label}>
  <h4>{day.label}</h4>
  {day.matches.map(match=>{const iptv=iptvEventFor(events,{id:match.id,date:match.date,home:match.home,away:match.away}),score=match.home.score!==null&&!['pre','postponed'].includes(match.state),status=phaseLabel(match,kickOff),round=[match.round,match.leg].filter(Boolean).join(' · ');
   return <button key={match.id} className={`league-fixture ${followed.has(match.home.id)||followed.has(match.away.id)?'is-followed':''}`} data-state={match.state} onClick={()=>open({slug:match.slug,id:match.id,round:round||null,fallback:match})} aria-label={`${match.home.name} contra ${match.away.name}, ${status}${score?`, ${match.home.score} a ${match.away.score}`:''}${iptv?', en tu IPTV':''}. Ver detalle`}>
    <span className="league-fixture-status">{match.state==='live'&&<i aria-hidden="true"/>}{status}</span>
    <span className="league-fixture-team is-home"><span>{match.home.name}</span><Crest club={match.home}/></span>
    <span className="league-fixture-score">{score?<><b className={match.home.score>match.away.score?'is-ahead':''}>{match.home.score}</b>–<b className={match.away.score>match.home.score?'is-ahead':''}>{match.away.score}</b></>:<span>vs</span>}</span>
    <span className="league-fixture-team"><Crest club={match.away}/><span>{match.away.name}</span></span>
    <span className="league-fixture-extra">{iptv?<em className="league-iptv"><Tv aria-hidden="true"/>En tu IPTV</em>:round?<small>{round}</small>:null}</span>
   </button>;})}
 </section>)}</div>;
}
// Same rows, columns and heights as the real content: the panel never changes size when data lands.
const TableSkeleton=()=><div className="league-table league-skeleton" aria-hidden="true">{HEAD}{Array.from({length:20},(_,index)=><div className="league-table-row" key={index}><i className="bone bone-rank"/><span className="league-club"><i className="bone bone-crest"/><i className="bone" style={{width:`${48+(index*37)%40}%`}}/></span>{Array.from({length:8},(_,cell)=><i className={`bone bone-cell ${cell===7?'bone-form':''}`} key={cell}/>)}</div>)}<div className="league-zones"><i className="bone" style={{width:120}}/><i className="bone" style={{width:90}}/><i className="bone" style={{width:70}}/></div></div>;
const ListSkeleton=()=><ol className="league-leaders league-skeleton" aria-hidden="true">{Array.from({length:10},(_,index)=><li key={index}><i className="bone bone-rank"/><span className="league-player"><i className="bone" style={{width:`${55+(index*29)%35}%`}}/><i className="bone bone-sub"/></span><i className="bone bone-value"/></li>)}</ol>;

export const LeagueStats=memo(function LeagueStats({league}){
 const entry=competitionByLabel(league),slug=entry?.key||null,table=entry?.table!==false;
 const {status,standings,leaders,fixtures,updatedAt,retry}=useLeagueStats(slug);
 const {openMatch,events}=useContext(MatchDetailContext),follow=useContext(FollowContext);
 const tabs=table?[['fixtures','Fecha','partidos'],['goals','Goleadores','goles'],['assists','Asistencias','asistencias']]:[['fixtures','Fecha','partidos']];
 const [chosen,setTab]=useState('fixtures'),[pickedGroup,setGroup]=useState(0),tab=tabs.some(([key])=>key===chosen)?chosen:'fixtures';
 const form=useMemo(()=>recentForm(fixtures||[]),[fixtures]),followed=useMemo(()=>new Set(follow.teams),[follow.teams]);
 // «1–0 67'» beside a club playing right now.
 const live=useMemo(()=>{const map=new Map();for(const match of fixtures||[])if(match.state==='live'){const label=`${match.home.score??0}–${match.away.score??0} · ${phaseLabel(match,kickOff)}`;map.set(match.home.id,label);map.set(match.away.id,label);}return map;},[fixtures]);
 if(!slug)return null;
 const hasData=status==='ready'||status==='refreshing',index=tabs.findIndex(([key])=>key===tab),groups=standings?.groups||[],group=Math.min(pickedGroup,Math.max(0,groups.length-1));
 const heading=[standings?.stage||standings?.tournament,standings?.season&&`Temporada ${standings.season}`].filter(Boolean).join(' · ');
 // With data and no table at all, the fixtures and leaders take the whole width instead of an empty half.
 const showTable=table&&!(hasData&&!groups.some(option=>option.rows.length));
 const keyTab=event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)&&!document.querySelector('.tv-mode')){event.preventDefault();const next=tabs[(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length][0];setTab(next);event.currentTarget.parentElement.querySelector(`[data-tab="${next}"]`)?.focus();}};
 const panel=tab==='fixtures'?<Fixtures fixtures={fixtures||[]} events={events||[]} followed={followed} open={openMatch||(()=>{})}/>:<Leaders key={tab} list={(tab==='goals'?leaders?.goals:leaders?.assists)||[]} unit={tabs[index][2]} followed={followed}/>;
 return <section className={`league-stats ${showTable?'':'league-stats-wide'}`} aria-label={`${league}: tabla, fecha y líderes`} aria-busy={status==='loading'||status==='refreshing'}>
  <header className="league-stats-heading">
   <h2>{league}{heading&&<span> · {heading}</span>}</h2>
   <p className="league-status" aria-live="polite" data-state={status}>
    {live.size>0&&<span className="league-live-pill"><i aria-hidden="true"/>En juego</span>}
    {status==='refreshing'&&<><i className="league-spinner" aria-hidden="true"/>Actualizando</>}
    {status==='loading'&&<><i className="league-spinner" aria-hidden="true"/>Cargando</>}
    {status==='ready'&&updatedAt&&<>Actualizado {time(updatedAt)}</>}
    <span className="league-source">ESPN</span>
   </p>
  </header>
  {status==='error'?<div className="league-error league-reveal" role="alert">
   <p><b>No pudimos cargar {league}.</b> Revisa tu conexión e inténtalo de nuevo.</p>
   <button className="league-retry" data-league-focus="" onClick={retry}><RotateCw aria-hidden="true"/>Reintentar</button>
  </div>:<div className="league-stats-body" key={slug}>
   {table&&!showTable&&<p className="league-stage-note">ESPN todavía no publica la tabla de {league}.</p>}
   {showTable&&<div className="league-table-panel">
    {standings?.earlier&&<p className="league-stage-note">{standings.stage} · ESPN aún no publica la tabla de la etapa en curso.</p>}
    {groups.length>1&&<div className="league-groups" role="group" aria-label="Grupo">{groups.map((option,at)=><button key={option.name||at} className={`league-group ${at===group?'selected':''}`} aria-pressed={at===group} onClick={()=>setGroup(at)}>{option.name||`Grupo ${at+1}`}</button>)}</div>}
    {hasData?groups[group]?.rows.length?<Standings key={group} rows={groups[group].rows} zones={standings.zones} form={form} live={live} followed={followed}/>:<p className="league-note league-reveal">Sin tabla publicada todavía.</p>:<TableSkeleton/>}
   </div>}
   <div className="league-leaders-panel">
    {tabs.length>1&&<div className="league-tabs" role="tablist" aria-label="Fecha y líderes" style={{'--tab':index,'--tabs':tabs.length}}>
     <span className="league-tab-pill" aria-hidden="true"/>
     {tabs.map(([key,label])=><button key={key} data-tab={key} role="tab" className={`league-tab ${tab===key?'selected':''}`} aria-selected={tab===key} tabIndex={tab===key?0:-1} data-league-focus={tab===key?'':undefined} onClick={()=>setTab(key)} onFocus={()=>setTab(key)} onKeyDown={keyTab}>{label}</button>)}
    </div>}
    <div role="tabpanel" className="league-tabpanel" aria-label={tabs[index][1]}>{hasData?panel:<ListSkeleton/>}</div>
   </div>
  </div>}
 </section>;
});
