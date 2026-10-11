import {eventInstant} from './eventTime.js';
import {footballMatchup,footballTeam,FOOTBALL_LEAGUES} from './footballArtwork.js';
const leagueLabel=new Map(FOOTBALL_LEAGUES),H=3600000;
export const FOOTBALL_SCOREBOARD_URL='https://site.api.espn.com/apis/site/v2/sports/soccer';
// ESPN's `dates` parameter follows US Eastern days; European kick-offs never cross its midnight.
export function footballEventDate(item){
 const time=eventInstant(item.eventStartsAt);if(time===null)return null;
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(time)).map(part=>[part.type,part.value]));
 return `${parts.year}${parts.month}${parts.day}`;
}
// One scoreboard per league and day, only for leagues both identified clubs play in. ESPN rejects day ranges for soccer.
export function scoreboardRequests(items,limit=16){
 const requests=new Set();
 for(const item of items){
  // The date first: it is cheap, and most of a provider's channels have no kick-off time.
  const date=footballEventDate(item),matchup=date&&footballMatchup(item);if(matchup?.teams.length!==2)continue;
  const [first,second]=matchup.teams;for(const league of first.leagues)if(second.leagues.includes(league))requests.add(`${league}|${date}`);
 }
 return [...requests].sort((a,b)=>a.split('|')[1].localeCompare(b.split('|')[1])||a.localeCompare(b)).slice(0,limit);
}
const STATE={in:'Live',post:'Final',pre:'Preview'};
// No goals, no score: nothing is ever invented. `clock` is ESPN's «67'», «45'+2'».
function matchScore(event,away,home){
 const status=event.competitions?.[0]?.status||event.status,state=STATE[status?.type?.state];
 const goals=[away,home].map(side=>side.score===undefined||side.score===''?NaN:Number(side.score));
 if(!['Live','Final'].includes(state)||!goals.every(Number.isFinite))return null;
 return {sport:'futbol',away:goals[0],home:goals[1],state,clock:status.displayClock||null,period:status.period??null,short:status.type.shortDetail||null,teams:[`futbol:${away.team.id}`,`futbol:${home.team.id}`]};
}
function matchDetail(type){
 const name=`${type?.name||''} ${type?.description||''}`;
 if(/postponed|cancel|abandon|suspend|forfeit/i.test(name))return 'Postponed';
 return type?.state==='in'?'In Progress':type?.state==='post'?'Final':'Scheduled';
}
export function scoreboardGames(data,league){
 return (data?.events||[]).flatMap(event=>{
  const competitors=event.competitions?.[0]?.competitors||[],home=competitors.find(side=>side.homeAway==='home'),away=competitors.find(side=>side.homeAway==='away');
  const startsAt=eventInstant(event.date);
  if(!/^\d{1,12}$/.test(String(event.id))||!home||!away||startsAt===null||!footballTeam(`futbol:${home.team?.id}`)||!footballTeam(`futbol:${away.team?.id}`))return [];
  const status=event.competitions[0].status||event.status,score=matchScore(event,away,home);
  return [{id:`futbol:${event.id}`,league,startsAt,teams:[`futbol:${away.team.id}`,`futbol:${home.team.id}`],detail:matchDetail(status?.type),...score&&{score}}];
 });
}
// «67' · 2 – 1», «Descanso · 1 – 0», «Final · 3 – 2». Goals follow `firstId` (the crest on the left), else away – home.
export function footballScoreLabel(score,firstId){
 if(!score||!['Live','Final'].includes(score.state))return null;
 const flip=firstId===score.teams?.[1],first=flip?score.home:score.away,second=flip?score.away:score.home,runs=`${first} – ${second}`;
 const short=score.short||'',inning=score.state==='Final'?'Final':/^HT$|half\s*time/i.test(short)?'Descanso':/pen/i.test(short)?'Penales':score.clock||'';
 return {first,second,runs,inning,final:score.state==='Final',text:[inning,runs].filter(Boolean).join(' · ')};
}
export function reconcileFootballEvent(item,games){
 const start=eventInstant(item.eventStartsAt);if(start===null)return item;
 const matchup=footballMatchup(item);if(matchup?.teams.length!==2)return item;
 const ids=matchup.teams.map(team=>team.id);
 // Provider clocks can be off by a time zone; a club plays at most once within half a day.
 const matches=games.filter(game=>ids.every(id=>game.teams.includes(id))&&Math.abs(game.startsAt-start)<=12*H).sort((a,b)=>Math.abs(a.startsAt-start)-Math.abs(b.startsAt-start));
 if(!matches.length)return item;
 const game=matches[0],unavailable=game.detail==='Postponed';
 return {...item,eventStartsAt:unavailable?null:game.startsAt,eventScheduleSource:'ESPN',eventScheduleState:unavailable?'postponed':null,eventOfficialId:game.id,eventDetail:game.detail,eventScore:game.score||null,eventLeague:leagueLabel.get(game.league)||null,eventLeagueSlug:game.league};
}
