import React,{memo,useState} from 'react';
import {useLeagueStats} from './useLeagueStats.js';
import {leagueSlug} from './leagueStats.js';
import './leagueStats.css';

// «Fútbol» page, one league chip selected: its standings beside the top scorers or assists, even on days without matches.
// Static text and local crests; the only focusable controls are the two tabs (remote: Up = chips, Down = event rows).
const Crest=({club})=><span className="league-crest" aria-hidden="true">{club.logo?<img src={import.meta.env.BASE_URL+club.logo} alt="" loading="lazy" decoding="async"/>:<b>{club.abbreviation.slice(0,3)}</b>}</span>;
const signed=value=>value===null?'':value>0?`+${value}`:String(value);
function Standings({standings}){
 return <div className="league-table" role="table" aria-label="Tabla de posiciones">
  <div className="league-table-row league-table-head" role="row"><span role="columnheader">#</span><span role="columnheader">Club</span><span role="columnheader" title="Partidos jugados">PJ</span><span role="columnheader" title="Ganados">G</span><span role="columnheader" title="Empatados">E</span><span role="columnheader" title="Perdidos">P</span><span role="columnheader" title="Goles a favor y en contra">Goles</span><span role="columnheader" title="Diferencia de gol">DG</span><span role="columnheader" title="Puntos">Pts</span></div>
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
 if(!list.length)return <p className="league-empty">ESPN todavía no publica esta lista.</p>;
 return <ol className="league-leaders">{list.map(player=><li key={player.id}>
  <span className="league-rank">{player.rank}</span>
  <span className="league-player"><b>{player.name}</b><span><Crest club={player.club}/>{player.club.name}{player.matches!==null?` · ${player.matches} PJ`:''}</span></span>
  <span className="league-value" aria-label={`${player.value} ${unit}`}>{player.value}</span>
 </li>)}</ol>;
}
export const LeagueStats=memo(function LeagueStats({league}){
 const slug=leagueSlug(league),{status,standings,leaders}=useLeagueStats(slug),[tab,setTab]=useState('goals');
 if(!slug)return null;
 const season=standings?.season?` · Temporada ${standings.season}`:'',list=tab==='goals'?leaders?.goals||[]:leaders?.assists||[];
 return <section className="league-stats" aria-label={`${league}: tabla y líderes`} aria-busy={status==='loading'}>
  <div className="league-stats-heading"><h2>{league}{season}</h2><p>{standings?.phase?`${standings.phase==='League Phase'?'Fase de liga':standings.phase} · `:''}Datos de ESPN</p></div>
  {status==='loading'&&<p className="league-empty">Cargando la tabla…</p>}
  {status==='error'&&<p className="league-empty">No pudimos cargar los datos de {league}. Vuelve a intentarlo en unos minutos.</p>}
  {status==='ready'&&<div className="league-stats-body">
   {standings?.rows.length?<Standings standings={standings}/>:<p className="league-empty">Sin tabla publicada todavía.</p>}
   <div className="league-leaders-panel">
    <div className="league-tabs" role="tablist" aria-label="Líderes">
     {[['goals','Goleadores'],['assists','Asistencias']].map(([key,label])=><button key={key} role="tab" className={`league-tab ${tab===key?'selected':''}`} aria-selected={tab===key} onClick={()=>setTab(key)} onFocus={event=>event.currentTarget.closest('.league-stats').scrollIntoView({block:'start',behavior:'instant'})}>{label}</button>)}
    </div>
    <div role="tabpanel" aria-label={tab==='goals'?'Goleadores':'Asistencias'}><Leaders list={list} unit={tab==='goals'?'goles':'asistencias'}/></div>
   </div>
  </div>}
 </section>;
});
