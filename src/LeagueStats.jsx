import React,{memo,useState} from 'react';
import {RotateCw} from 'lucide-react';
import {useLeagueStats} from './useLeagueStats.js';
import {leagueSlug} from './leagueStats.js';
import './leagueStats.css';

// «Fútbol» page, one league chip selected: its standings beside the top scorers or assists, even on days without matches.
// While loading, a skeleton with the final geometry holds the space (nothing jumps); data fades in once. The two tabs are a
// segmented control whose pill slides; switching never scrolls. Remote: the selected tab (or «Reintentar») sits between
// the chips and the event rows (`data-league-focus`, see useRemoteNavigation).
const TABS=[['goals','Goleadores','goles'],['assists','Asistencias','asistencias']];
const time=value=>new Date(value).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const Crest=({club})=><span className="league-crest" aria-hidden="true">{club.logo?<img src={import.meta.env.BASE_URL+club.logo} alt="" decoding="async"/>:<b>{club.abbreviation.slice(0,3)}</b>}</span>;
const signed=value=>value===null?'':value>0?`+${value}`:String(value);
const HEAD=<div className="league-table-row league-table-head" role="row"><span role="columnheader">#</span><span role="columnheader">Club</span><span role="columnheader" title="Partidos jugados">PJ</span><span role="columnheader" title="Ganados">G</span><span role="columnheader" title="Empatados">E</span><span role="columnheader" title="Perdidos">P</span><span role="columnheader" title="Goles a favor y en contra">Goles</span><span role="columnheader" title="Diferencia de gol">DG</span><span role="columnheader" title="Puntos">Pts</span></div>;
function Standings({standings}){
 return <div className="league-table league-reveal" role="table" aria-label="Tabla de posiciones">
  {HEAD}
  {standings.rows.map(row=><div className="league-table-row" role="row" key={row.id} style={row.zone?{'--zone':row.zone.color}:undefined} data-zone={row.zone?'':undefined}>
   <span role="cell" className="league-rank">{row.rank}</span>
   <span role="cell" className="league-club"><Crest club={row}/><span>{row.name}</span></span>
   <span role="cell">{row.played??''}</span><span role="cell">{row.wins??''}</span><span role="cell">{row.draws??''}</span><span role="cell">{row.losses??''}</span>
   <span role="cell" className="league-goals">{row.goalsFor??''}:{row.goalsAgainst??''}</span><span role="cell">{signed(row.difference)}</span>
   <span role="cell" className="league-points">{row.points??''}</span>
  </div>)}
  {standings.zones.length>0&&<ul className="league-zones" aria-label="Zonas de la tabla">{standings.zones.map(zone=><li key={zone.label} style={{'--zone':zone.color}}>{zone.label}</li>)}</ul>}
 </div>;
}
function Leaders({list,unit}){
 if(!list.length)return <p className="league-note league-reveal">ESPN todavía no publica esta lista.</p>;
 return <ol className="league-leaders league-reveal">{list.map(player=><li key={player.id}>
  <span className="league-rank">{player.rank}</span>
  <span className="league-player"><b>{player.name}</b><span><Crest club={player.club}/>{player.club.name}{player.matches!==null?` · ${player.matches} PJ`:''}</span></span>
  <span className="league-value" aria-label={`${player.value} ${unit}`}>{player.value}</span>
 </li>)}</ol>;
}
// Same rows, columns and heights as the real content: the panel never changes size when data lands.
const TableSkeleton=()=><div className="league-table league-skeleton" aria-hidden="true">{HEAD}{Array.from({length:20},(_,index)=><div className="league-table-row" key={index}><i className="bone bone-rank"/><span className="league-club"><i className="bone bone-crest"/><i className="bone" style={{width:`${48+(index*37)%40}%`}}/></span>{Array.from({length:7},(_,cell)=><i className="bone bone-cell" key={cell}/>)}</div>)}<div className="league-zones"><i className="bone" style={{width:120}}/><i className="bone" style={{width:90}}/><i className="bone" style={{width:70}}/></div></div>;
const LeadersSkeleton=()=><ol className="league-leaders league-skeleton" aria-hidden="true">{Array.from({length:10},(_,index)=><li key={index}><i className="bone bone-rank"/><span className="league-player"><i className="bone" style={{width:`${55+(index*29)%35}%`}}/><i className="bone bone-sub"/></span><i className="bone bone-value"/></li>)}</ol>;

export const LeagueStats=memo(function LeagueStats({league}){
 const slug=leagueSlug(league),{status,standings,leaders,updatedAt,retry}=useLeagueStats(slug),[tab,setTab]=useState('goals');
 if(!slug)return null;
 const hasData=status==='ready'||status==='refreshing',index=TABS.findIndex(([key])=>key===tab),unit=TABS[index][2];
 const phase=standings?.phase==='League Phase'?'Fase de liga':standings?.phase;
 const keyTab=event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)&&!document.querySelector('.tv-mode')){event.preventDefault();const next=TABS[(index+(event.key==='ArrowRight'?1:TABS.length-1))%TABS.length][0];setTab(next);event.currentTarget.parentElement.querySelector(`[data-tab="${next}"]`)?.focus();}};
 return <section className="league-stats" aria-label={`${league}: tabla y líderes`} aria-busy={status==='loading'||status==='refreshing'}>
  <header className="league-stats-heading">
   <h2>{league}{standings?.season&&<span> · Temporada {standings.season}</span>}</h2>
   <p className="league-status" aria-live="polite" data-state={status}>
    {status==='refreshing'&&<><i className="league-spinner" aria-hidden="true"/>Actualizando</>}
    {status==='loading'&&<><i className="league-spinner" aria-hidden="true"/>Cargando</>}
    {status==='ready'&&updatedAt&&<>{phase?`${phase} · `:''}Actualizado {time(updatedAt)}</>}
    <span className="league-source">ESPN</span>
   </p>
  </header>
  {status==='error'?<div className="league-error league-reveal" role="alert">
   <p><b>No pudimos cargar {league}.</b> Revisa tu conexión e inténtalo de nuevo.</p>
   <button className="league-retry" data-league-focus="" onClick={retry}><RotateCw aria-hidden="true"/>Reintentar</button>
  </div>:<div className="league-stats-body" key={slug}>
   {hasData?standings?.rows.length?<Standings standings={standings}/>:<p className="league-note league-reveal">Sin tabla publicada todavía.</p>:<TableSkeleton/>}
   <div className="league-leaders-panel">
    <div className="league-tabs" role="tablist" aria-label="Líderes" style={{'--tab':index}}>
     <span className="league-tab-pill" aria-hidden="true"/>
     {TABS.map(([key,label])=><button key={key} data-tab={key} role="tab" className={`league-tab ${tab===key?'selected':''}`} aria-selected={tab===key} tabIndex={tab===key?0:-1} data-league-focus={tab===key?'':undefined} onClick={()=>setTab(key)} onFocus={()=>setTab(key)} onKeyDown={keyTab}>{label}</button>)}
    </div>
    <div role="tabpanel" className="league-tabpanel" aria-label={TABS[index][1]}>{hasData?<Leaders key={tab} list={(tab==='goals'?leaders?.goals:leaders?.assists)||[]} unit={unit}/>:<LeadersSkeleton/>}</div>
   </div>
  </div>}
 </section>;
});
