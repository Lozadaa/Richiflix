import {mlbMatchup,mlbTeams} from './mlbArtwork.js';
import {eventPhase} from './liveEvents.js';
import {eventInstant} from './eventTime.js';

// Fase L7: followed MLB teams. Pure; App owns the clock and the toast.
const MIN=60000,ALERT_WINDOW=10*MIN,byId=new Map(mlbTeams.map(team=>[team.id,team]));
export const eventTeams=event=>mlbMatchup(event)?.teams.map(team=>team.id)||[];
export function followedEventIds(events,teams){const followed=new Set(teams),ids=new Set();if(followed.size)for(const event of events)if(eventTeams(event).some(id=>followed.has(id)))ids.add(event.id);return ids;}
export const teamLabel=id=>byId.get(id)?.teamName||'';
export const teamAbbreviation=id=>byId.get(id)?.abbreviation||'';
// «Yankees vs. Rays»; one identified team falls back to the event title.
const eventLabel=event=>{const ids=eventTeams(event);return ids.length===2?ids.map(teamLabel).join(' vs. '):event.title;};
// Stage 'soon' = starts in ≤10 min, 'live' = in play. One alert per event and stage; an event
// already live when first seen only alerts 'live'. Returns the alerts and the new notified Set.
export function upcomingAlerts({events,teams,now=Date.now(),notified=new Set()}){
 const followed=followedEventIds(events,teams),next=new Set(notified),alerts=[];
 for(const event of events){
  if(!followed.has(event.id))continue;
  const phase=eventPhase(event,now),start=eventInstant(event.eventStartsAt);
  const stage=phase==='live'?'live':phase==='soon'&&start!==null&&start-now<=ALERT_WINDOW?'soon':null;
  if(!stage||next.has(`${event.id}:${stage}`))continue;
  next.add(`${event.id}:${stage}`);if(stage==='live')next.add(`${event.id}:soon`);
  alerts.push({event,stage,text:stage==='live'?`${eventLabel(event)} está en juego · OK para ver`:`${eventLabel(event)} empieza en ${Math.max(1,Math.ceil((start-now)/MIN))} min · OK para ver`});
 }
 return {alerts,notified:next};
}
