import {footballTeam,competitionByLabel,FOOTBALL_COMPETITIONS} from './footballArtwork.js';

// League panel of the «Fútbol» page: standings, leaders, the month's fixtures and each club's recent form,
// from ESPN's public API. Pure parsers; useLeagueStats owns fetching and the cache. Nothing is invented.
export const leagueSlug=label=>competitionByLabel(label)?.key||null;
export const competition=key=>FOOTBALL_COMPETITIONS.find(entry=>entry.key===key)||null;
const API='https://site.api.espn.com/apis';
export const STANDINGS_URL=slug=>`${API}/v2/sports/soccer/${slug}/standings`;
export const LEADERS_URL=slug=>`${API}/site/v2/sports/soccer/${slug}/statistics`;
export const FIXTURES_URL=(slug,month)=>`${API}/site/v2/sports/soccer/${slug}/scoreboard?dates=${month}`;
export const SUMMARY_URL=(slug,id)=>`${API}/site/v2/sports/soccer/${slug}/summary?event=${id}`;
const ZONES=[[/^champions league$/i,'Champions League'],[/champions league qualifying/i,'Previa de Champions'],[/^europa league$/i,'Europa League'],[/europa league qualifying/i,'Previa de Europa League'],[/conference league/i,'Conference League'],[/libertadores/i,'Libertadores'],[/sudamericana/i,'Sudamericana'],[/relegation playoff/i,'Promoción'],[/relegation/i,'Descenso'],[/round of 16/i,'Octavos de final'],[/quarter/i,'Cuartos de final'],[/knockout round playoffs|playoff/i,'Playoff'],[/eliminated/i,'Eliminado'],[/advance|qualif/i,'Clasifica']];
const GROUPS=[[/^group ([a-z])$/i,'Grupo $1'],[/^eastern conference$/i,'Conferencia Este'],[/^western conference$/i,'Conferencia Oeste'],[/^league phase$/i,'Fase de liga']];
const ROUNDS=[[/final$/i,'Final'],[/semifinal/i,'Semifinal'],[/quarterfinal/i,'Cuartos de final'],[/round of 16/i,'Octavos de final'],[/round of 32/i,'Dieciseisavos'],[/playoff/i,'Playoff']];
const translate=(rules,value)=>{for(const [test,label] of rules)if(test.test(value||''))return label.includes('$')?String(value).replace(test,label):label;return value||null;};
const zone=note=>{if(!note?.description)return null;const label=ZONES.find(([test])=>test.test(note.description))?.[1]||note.description;return {label,color:/^#[0-9a-f]{6}$/i.test(note.color||'')?note.color:'#7d8aa3'};};
const number=value=>{if(value===''||value===null||value===undefined)return null;const parsed=Number(String(value).replace('+',''));return Number.isFinite(parsed)?parsed:null;};
// Local crest and short name when the team is known; ESPN's names otherwise.
export function club(team){
 const known=footballTeam(`futbol:${team?.id}`);
 return {id:`futbol:${team?.id}`,name:known?.teamName||team?.shortDisplayName||team?.displayName||team?.name||'',abbreviation:known?.abbreviation||team?.abbreviation||'',logo:known?.logo||null};
}
// One table per group (Libertadores groups, Argentine zones, MLS conferences); most leagues have one.
export function parseStandings(data){
 const children=(data?.children||[]).filter(child=>Array.isArray(child.standings?.entries)&&child.standings.entries.length);
 if(!children.length)return null;
 const groups=children.map(child=>{
  const rows=child.standings.entries.map(entry=>{
   const stats=Object.fromEntries((entry.stats||[]).map(stat=>[stat.name,stat.displayValue??stat.value]));
   return {...club(entry.team),rank:number(stats.rank),played:number(stats.gamesPlayed),wins:number(stats.wins),draws:number(stats.ties),losses:number(stats.losses),goalsFor:number(stats.pointsFor),goalsAgainst:number(stats.pointsAgainst),difference:number(stats.pointDifferential),points:number(stats.points),zone:zone(entry.note)};
  }).filter(row=>row.name&&row.rank!==null).sort((a,b)=>a.rank-b.rank);
  const name=/^\d{4}/.test(child.name||'')?null:translate(GROUPS,child.name);
  return {name,rows};
 }).filter(group=>group.rows.length);
 const season=/^\d{4}-\d{2}/.exec(children[0].standings.seasonDisplayName||'')?.[0]||/^\d{4}/.exec(children[0].name||'')?.[0]||null;
 const tournament=/^\d{4}\s+(.+)$/.exec(children[0].name||'')?.[1]||null;
 const zones=[...new Map(groups.flatMap(group=>group.rows).filter(row=>row.zone).map(row=>[row.zone.label,row.zone])).values()];
 return {season,tournament:tournament?translate([[/^torneo apertura$/i,'Apertura'],[/^torneo clausura$/i,'Clausura']],tournament):null,groups,rows:groups[0].rows,zones};
}
export function parseLeaders(data,limit=10){
 const list=name=>(data?.stats?.find(stat=>stat.name===name)?.leaders||[]).slice(0,limit).flatMap((leader,index)=>{
  const athlete=leader.athlete,value=number(leader.value);if(!athlete?.displayName||value===null)return [];
  const appearances=number(athlete.statistics?.find(stat=>stat.name==='appearances')?.value);
  return [{id:String(athlete.id||index),rank:index+1,name:athlete.displayName,shortName:athlete.shortName||athlete.displayName,club:club(athlete.team),value,matches:appearances}];
 });
 return {goals:list('goalsLeaders'),assists:list('assistsLeaders')};
}
const STATE={pre:'pre',in:'live',post:'final'};
// A month of matches. `state`: pre · live · final · postponed. Legs and knockout rounds keep their Spanish label.
export function parseFixtures(data,slug){
 return (data?.events||[]).flatMap(event=>{
  const match=event.competitions?.[0],sides=match?.competitors||[],home=sides.find(side=>side.homeAway==='home'),away=sides.find(side=>side.homeAway==='away');
  const date=Date.parse(event.date);if(!/^\d{1,12}$/.test(String(event.id))||!home||!away||!Number.isFinite(date))return [];
  const type=(match.status||event.status)?.type||{},postponed=/postponed|cancel|abandon|suspend/i.test(`${type.name||''} ${type.description||''}`);
  const side=value=>({...club(value.team),score:number(value.score),winner:value.winner===true});
  const leg=/1st leg/i.test(match.notes?.[0]?.headline||'')?'Ida':/2nd leg/i.test(match.notes?.[0]?.headline||'')?'Vuelta':null;
  return [{id:String(event.id),slug,date,state:postponed?'postponed':STATE[type.state]||'pre',clock:(match.status||event.status)?.displayClock||null,short:type.shortDetail||null,home:side(home),away:side(away),round:translate(ROUNDS,match.series?.title||''),leg}];
 }).sort((a,b)=>a.date-b.date);
}
// Last five finished matches per team, oldest first: 'G' (ganado), 'E' (empate), 'P' (perdido).
export function recentForm(fixtures){
 const form=new Map();
 for(const match of fixtures.filter(entry=>entry.state==='final'&&entry.home.score!==null&&entry.away.score!==null).sort((a,b)=>a.date-b.date)){
  for(const [team,own,other] of [[match.home,match.home.score,match.away.score],[match.away,match.away.score,match.home.score]]){
   const list=form.get(team.id)||[];list.push(own>other?'G':own<other?'P':'E');form.set(team.id,list.slice(-5));
  }
 }
 return form;
}
// «Hoy», «Mañana», «Ayer» or «sáb 18 oct», on Santiago's calendar like every other time in the app.
const ZONE='America/Santiago';
const dayKey=time=>new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
export function dayLabel(time,now=Date.now()){
 const gap=Math.round((Date.parse(dayKey(time))-Date.parse(dayKey(now)))/86400000);
 if(gap===0)return 'Hoy';if(gap===1)return 'Mañana';if(gap===-1)return 'Ayer';
 return new Intl.DateTimeFormat('es-CL',{timeZone:ZONE,weekday:'short',day:'numeric',month:'short'}).format(new Date(time)).replace(/[.,]/g,'');
}
export const kickOff=time=>new Intl.DateTimeFormat('es-CL',{timeZone:ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(time));
// The panel's «Fecha»: what is live, the last three days and the next eight, grouped by day. With nothing in that
// window, the closest matches on either side so a league between rounds still shows its next date.
export function fixtureDays(fixtures,now=Date.now(),limit=24){
 const DAY=86400000,near=fixtures.filter(match=>match.state==='live'||match.date>=now-3*DAY&&match.date<=now+8*DAY);
 const chosen=(near.length?near:[...fixtures.filter(match=>match.date<now).slice(-6),...fixtures.filter(match=>match.date>=now).slice(0,10)]).slice(0,limit);
 const days=new Map();for(const match of chosen){const key=dayKey(match.date);if(!days.has(key))days.set(key,{key,label:dayLabel(match.date,now),matches:[]});days.get(key).matches.push(match);}
 return [...days.values()];
}
// Months to read: this one, the previous (form and recent results) and the next near the end of the month.
export function fixtureMonths(now=Date.now()){
 const date=new Date(now),month=offset=>{const value=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+offset,1));return `${value.getUTCFullYear()}${String(value.getUTCMonth()+1).padStart(2,'0')}`;};
 return [month(-1),month(0),...(date.getUTCDate()>=20?[month(1)]:[])];
}
