import {eventInstant} from './eventTime.js';
import {mlbMatchup,mlbTeams} from './mlbArtwork.js';
const known=new Set(mlbTeams.map(team=>team.id));
export const MLB_SCHEDULE_URL='https://statsapi.mlb.com/api/v1/schedule';
export function mlbEventDate(item){
 const time=eventInstant(item.eventStartsAt);if(time===null)return null;
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(time)).map(part=>[part.type,part.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
}
export function scheduleGames(data){
 return (data.dates||[]).flatMap(day=>(day.games||[]).filter(game=>!game.startTimeTBD&&known.has(game.teams?.home?.team?.id)&&known.has(game.teams?.away?.team?.id)&&eventInstant(game.gameDate)!==null).map(game=>({id:game.gamePk,date:game.officialDate||day.date,startsAt:eventInstant(game.gameDate),teams:[game.teams.away.team.id,game.teams.home.team.id],detail:game.status?.detailedState})));
}
export function reconcileMLBEvent(item,games){
 const date=mlbEventDate(item);if(!date)return item;
 const matchup=mlbMatchup(item);if(matchup?.teams.length!==2)return item;
 const ids=matchup.teams.map(team=>team.id);
 const matches=games.filter(game=>game.date===date&&ids.every(id=>game.teams.includes(id))).sort((a,b)=>Math.abs(a.startsAt-item.eventStartsAt)-Math.abs(b.startsAt-item.eventStartsAt));
 // A doubleheader needs a unique clock match; never attach the other game.
 if(!matches.length||(matches.length>1&&(Math.abs(matches[0].startsAt-item.eventStartsAt)>45*60000||Math.abs(matches[0].startsAt-item.eventStartsAt)===Math.abs(matches[1].startsAt-item.eventStartsAt))))return item;
 const game=matches[0],unavailable=/postponed|cancelled|canceled/i.test(game.detail||'');
 return {...item,eventStartsAt:unavailable?null:game.startsAt,eventScheduleSource:'MLB',eventScheduleState:unavailable?'postponed':null,eventOfficialId:game.id};
}
