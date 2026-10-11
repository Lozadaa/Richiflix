import {club} from './leagueStats.js';

// ESPN match summary → what the detail dialog shows: score and phase, goals/cards/substitutions by minute,
// a few comparable stats and both line-ups. Pure; MatchDetail owns fetching (every 30 s while the match is live).
const STATE={pre:'pre',in:'live',post:'final'};
const KINDS=[[/own goal/i,'own'],[/penalty - scored/i,'penalty'],[/penalty - missed|penalty - saved/i,null],[/goal/i,'goal'],[/red card|second yellow/i,'red'],[/yellow card/i,'yellow'],[/substitution/i,'sub']];
const STATS=[['possessionPct','Posesión','%'],['totalShots','Tiros'],['shotsOnTarget','Tiros al arco'],['wonCorners','Córners'],['foulsCommitted','Faltas'],['offsides','Fuera de juego'],['yellowCards','Amarillas'],['redCards','Rojas'],['saves','Atajadas'],['passPct','Precisión de pases','%']];
const number=value=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:null;};
const minute=clock=>{const text=clock?.displayValue||'';return /^\d/.test(text)?text:null;};
export function parseSummary(data){
 const header=data?.header?.competitions?.[0];if(!header)return null;
 const sides=header.competitors||[],home=sides.find(side=>side.homeAway==='home'),away=sides.find(side=>side.homeAway==='away');if(!home||!away)return null;
 const homeId=String(home.team?.id),type=header.status?.type||{},postponed=/postponed|cancel|abandon|suspend/i.test(`${type.name||''} ${type.description||''}`);
 const side=value=>({...club(value.team),score:value.score===undefined||value.score===''?null:number(value.score)});
 const events=(data.keyEvents||[]).flatMap(event=>{
  const text=`${event.type?.text||''}`,kind=KINDS.find(([test])=>test.test(text))?.[1];if(!kind)return [];
  const [first,second]=(event.participants||[]).map(participant=>participant.athlete?.displayName).filter(Boolean);
  if(!first&&kind!=='sub')return [];
  return [{id:String(event.id),kind,minute:minute(event.clock),side:String(event.team?.id)===homeId?'home':'away',player:first||'',other:second||null}];
 });
 const box=new Map((data.boxscore?.teams||[]).map(team=>[String(team.team?.id),new Map((team.statistics||[]).map(stat=>[stat.name,stat.displayValue]))]));
 const homeStats=box.get(homeId),awayStats=box.get(String(away.team?.id));
 const stats=homeStats&&awayStats?STATS.flatMap(([name,label,unit])=>{
  let a=number(homeStats.get(name)),b=number(awayStats.get(name));if(a===null||b===null)return [];
  if(unit==='%'&&a<=1&&b<=1&&name!=='possessionPct'){a=Math.round(a*100);b=Math.round(b*100);}
  return [{name,label,home:a,away:b,unit:unit||''}];
 }):[];
 const lineup=homeAway=>{
  const roster=(data.rosters||[]).find(entry=>entry.homeAway===homeAway);if(!roster?.roster?.length)return null;
  const player=entry=>({name:entry.athlete?.displayName||'',jersey:entry.jersey||'',position:entry.position?.abbreviation||'',out:entry.subbedOut===true});
  return {formation:roster.formation||null,starters:roster.roster.filter(entry=>entry.starter).map(player),bench:roster.roster.filter(entry=>!entry.starter&&entry.subbedIn).map(player)};
 };
 const venue=data.gameInfo?.venue;
 return {id:String(header.id||data.header?.id||''),date:Date.parse(header.date),state:postponed?'postponed':STATE[type.state]||'pre',clock:header.status?.displayClock||null,short:type.shortDetail||null,
  home:side(home),away:side(away),events,stats,lineups:{home:lineup('home'),away:lineup('away')},venue:venue?[venue.fullName,venue.address?.city].filter(Boolean).join(' · '):null};
}
// «67'», «Descanso», «Final», «Aplazado» or the kick-off time.
export function phaseLabel(match,kickOff){
 if(!match)return '';
 if(match.state==='postponed')return 'Aplazado';
 if(match.state==='final')return /pen/i.test(match.short||'')?'Final · penales':/aet|extra/i.test(match.short||'')?'Final · alargue':'Final';
 if(match.state==='live')return /^HT$|half/i.test(match.short||'')?'Descanso':match.clock||'En juego';
 return kickOff(match.date);
}
