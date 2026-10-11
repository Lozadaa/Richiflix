import {footballTeam,FOOTBALL_LEAGUES} from './footballArtwork.js';

// League panel of the «Fútbol» page: standings, top scorers and assists from ESPN's public API.
// Pure parsers; useLeagueStats owns fetching and the cache. Nothing is invented: a missing field stays empty.
export const leagueSlug=label=>FOOTBALL_LEAGUES.find(([,name])=>name===label)?.[0]||null;
export const STANDINGS_URL=slug=>`https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`;
export const LEADERS_URL=slug=>`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/statistics`;
const ZONES=[[/^champions league$/i,'Champions League'],[/champions league qualifying/i,'Previa de Champions'],[/^europa league$/i,'Europa League'],[/europa league qualifying/i,'Previa de Europa League'],[/conference league/i,'Conference League'],[/relegation playoff/i,'Promoción'],[/relegation/i,'Descenso'],[/round of 16/i,'Octavos de final'],[/knockout round playoffs|playoff/i,'Playoff de eliminatorias'],[/eliminated/i,'Eliminado']];
const zone=note=>{if(!note?.description)return null;const label=ZONES.find(([test])=>test.test(note.description))?.[1]||note.description;return {label,color:/^#[0-9a-f]{6}$/i.test(note.color||'')?note.color:'#7d8aa3'};};
const number=value=>{const parsed=Number(String(value??'').replace('+',''));return Number.isFinite(parsed)?parsed:null;};
// Local crest and short name when the club is known; ESPN's names otherwise.
function club(team){
 const known=footballTeam(`futbol:${team?.id}`);
 return {id:`futbol:${team?.id}`,name:known?.teamName||team?.shortDisplayName||team?.displayName||team?.name||'',abbreviation:known?.abbreviation||team?.abbreviation||'',logo:known?.logo||null};
}
export function parseStandings(data){
 const group=data?.children?.[0]?.standings;if(!Array.isArray(group?.entries))return null;
 const rows=group.entries.map(entry=>{
  const stats=Object.fromEntries((entry.stats||[]).map(stat=>[stat.name,stat.displayValue??stat.value]));
  return {...club(entry.team),rank:number(stats.rank),played:number(stats.gamesPlayed),wins:number(stats.wins),draws:number(stats.ties),losses:number(stats.losses),goalsFor:number(stats.pointsFor),goalsAgainst:number(stats.pointsAgainst),difference:number(stats.pointDifferential),points:number(stats.points),zone:zone(entry.note)};
 }).filter(row=>row.name&&row.rank!==null).sort((a,b)=>a.rank-b.rank);
 const season=/^\d{4}-\d{2}/.exec(group.seasonDisplayName||'')?.[0]||null;
 return {season,phase:data.children[0].name&&!/^\d{4}/.test(data.children[0].name)?data.children[0].name:null,rows,zones:[...new Map(rows.filter(row=>row.zone).map(row=>[row.zone.label,row.zone])).values()]};
}
export function parseLeaders(data,limit=10){
 const list=name=>(data?.stats?.find(stat=>stat.name===name)?.leaders||[]).slice(0,limit).flatMap((leader,index)=>{
  const athlete=leader.athlete,value=number(leader.value);if(!athlete?.displayName||value===null)return [];
  const appearances=number(athlete.statistics?.find(stat=>stat.name==='appearances')?.value);
  return [{id:String(athlete.id||index),rank:index+1,name:athlete.displayName,shortName:athlete.shortName||athlete.displayName,club:club(athlete.team),value,matches:appearances}];
 });
 return {goals:list('goalsLeaders'),assists:list('assistsLeaders')};
}
