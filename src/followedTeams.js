import {mlbTeams} from './mlbArtwork.js';
import {footballTeams} from './footballArtwork.js';
import {matchupFor} from './matchup.js';
import {footballScoreLabel} from './footballSchedule.js';
import {eventPhase} from './liveEvents.js';
import {eventInstant} from './eventTime.js';

// Fase L7: followed MLB teams and football clubs (ids `futbol:<espnId>`). Pure; App owns the clock and the toast.
const MIN=60000,ALERT_WINDOW=10*MIN,byId=new Map([...mlbTeams,...footballTeams].map(team=>[team.id,team]));
export const eventTeams=event=>matchupFor(event)?.teams.map(team=>team.id)||[];
export function followedEventIds(events,teams){const followed=new Set(teams),ids=new Set();if(followed.size)for(const event of events)if(eventTeams(event).some(id=>followed.has(id)))ids.add(event.id);return ids;}
export const teamLabel=id=>byId.get(id)?.teamName||'';
export const teamAbbreviation=id=>byId.get(id)?.abbreviation||'';
// «Yankees vs. Rays»; one identified team falls back to the event title.
const eventLabel=event=>{const ids=eventTeams(event);return ids.length===2?ids.map(teamLabel).join(' vs. '):event.title;};
// Football: a followed match's score is remembered in `notified` («event:…:score:1-0»); a higher total than the last one
// seen is a goal. The first score seen for a match is only remembered (opening the app mid-game never alerts).
function goalAlert(event,notified){
 const score=event.eventScore,teams=matchupFor(event)?.teams;
 if(score?.sport!=='futbol'||score.stale||!Number.isFinite(score.home)||!Number.isFinite(score.away)||teams?.length!==2)return null;
 const prefix=`${event.id}:score:`,tag=`${prefix}${score.away}-${score.home}`;if(notified.has(tag))return null;
 const previous=[...notified].find(key=>key.startsWith(prefix));if(previous)notified.delete(previous);notified.add(tag);if(!previous)return null;
 const [away,home]=previous.slice(prefix.length).split('-').map(Number);if(score.away+score.home<=away+home)return null;
 const scorer=score.away>away?score.teams[0]:score.teams[1],label=footballScoreLabel(score,teams[0].id);
 return {event,stage:'goal',text:`Gol de ${teamLabel(scorer)||'tu equipo'} · ${teamLabel(teams[0].id)} ${label.runs} ${teamLabel(teams[1].id)} · OK para ver`};
}
// Stage 'soon' = starts in ≤10 min, 'live' = in play. One alert per event and stage; an event
// already live when first seen only alerts 'live'. Returns the alerts and the new notified Set.
export function upcomingAlerts({events,teams,now=Date.now(),notified=new Set()}){
 const followed=followedEventIds(events,teams),next=new Set(notified),alerts=[];
 for(const event of events){
  if(!followed.has(event.id))continue;
  const phase=eventPhase(event,now),start=eventInstant(event.eventStartsAt);
  const goal=phase==='live'?goalAlert(event,next):null;if(goal){alerts.push(goal);continue;}
  const stage=phase==='live'?'live':phase==='soon'&&start!==null&&start-now<=ALERT_WINDOW?'soon':null;
  if(!stage||next.has(`${event.id}:${stage}`))continue;
  next.add(`${event.id}:${stage}`);if(stage==='live')next.add(`${event.id}:soon`);
  alerts.push({event,stage,text:stage==='live'?`${eventLabel(event)} está en juego · OK para ver`:`${eventLabel(event)} empieza en ${Math.max(1,Math.ceil((start-now)/MIN))} min · OK para ver`});
 }
 return {alerts,notified:next};
}
