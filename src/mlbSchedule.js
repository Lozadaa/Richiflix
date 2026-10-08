import {eventInstant} from './eventTime.js';
import {mlbMatchup,mlbTeams} from './mlbArtwork.js';
const known=new Set(mlbTeams.map(team=>team.id));
export const MLB_SCHEDULE_URL='https://statsapi.mlb.com/api/v1/schedule';
export function mlbEventDate(item){
 const time=eventInstant(item.eventStartsAt);if(time===null)return null;
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(time)).map(part=>[part.type,part.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
}
// Fase L5: `hydrate=linescore` adds runs and inning. No runs, no score: nothing is ever invented.
function gameScore(game){
 const line=game.linescore,away=line?.teams?.away?.runs,home=line?.teams?.home?.runs;
 if(!Number.isFinite(away)||!Number.isFinite(home))return null;
 return {away,home,inning:line.currentInning??null,inningState:line.inningState||null,ordinal:line.currentInningOrdinal||null,state:game.status?.abstractGameState||null,teams:[game.teams.away.team.id,game.teams.home.team.id]};
}
export function scheduleGames(data){
 return (data.dates||[]).flatMap(day=>(day.games||[]).filter(game=>!game.startTimeTBD&&known.has(game.teams?.home?.team?.id)&&known.has(game.teams?.away?.team?.id)&&eventInstant(game.gameDate)!==null).map(game=>{const score=gameScore(game);return {id:game.gamePk,date:game.officialDate||day.date,startsAt:eventInstant(game.gameDate),teams:[game.teams.away.team.id,game.teams.home.team.id],detail:game.status?.detailedState,...score&&{score}};}));
}
// «7.ª ▲», «Med. 7.ª», «Fin 7.ª»; Final → «Final · 3 – 2». Runs follow `firstId` (the crest on the left), else away – home.
export function scoreLabel(score,firstId){
 if(!score||!['Live','Final'].includes(score.state))return null;
 const flip=firstId===score.teams?.[1],first=flip?score.home:score.away,second=flip?score.away:score.home,runs=`${first} – ${second}`,n=score.inning?`${score.inning}.ª`:'';
 const inning=score.state==='Final'?'Final':!n?'':{Top:`${n} ▲`,Bottom:`${n} ▼`,Middle:`Med. ${n}`,End:`Fin ${n}`}[score.inningState]||n;
 return {first,second,runs,inning,final:score.state==='Final',text:[inning,runs].filter(Boolean).join(' · ')};
}
export function reconcileMLBEvent(item,games){
 const date=mlbEventDate(item);if(!date)return item;
 const matchup=mlbMatchup(item);if(matchup?.teams.length!==2)return item;
 const ids=matchup.teams.map(team=>team.id);
 const matches=games.filter(game=>game.date===date&&ids.every(id=>game.teams.includes(id))).sort((a,b)=>Math.abs(a.startsAt-item.eventStartsAt)-Math.abs(b.startsAt-item.eventStartsAt));
 // A doubleheader needs a unique clock match; never attach the other game.
 if(!matches.length||(matches.length>1&&(Math.abs(matches[0].startsAt-item.eventStartsAt)>45*60000||Math.abs(matches[0].startsAt-item.eventStartsAt)===Math.abs(matches[1].startsAt-item.eventStartsAt))))return item;
 const game=matches[0],unavailable=/postponed|cancelled|canceled/i.test(game.detail||'');
 return {...item,eventStartsAt:unavailable?null:game.startsAt,eventScheduleSource:'MLB',eventScheduleState:unavailable?'postponed':null,eventOfficialId:game.id,eventDetail:game.detail||null,eventScore:game.score||null};
}
