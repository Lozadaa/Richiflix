import React,{useSyncExternalStore} from 'react';
import {Clock3} from 'lucide-react';
import {eventInstant,eventDay} from './eventTime.js';
import {eventPhase,eventPhaseLabel} from './liveEvents.js';

// Two shared clocks aligned to the wall clock: seconds only for the focused card,
// the expanded card and the banner; every other badge listens to minutes.
function createClock(period){
 let timer;const listeners=new Set();
 const run=()=>{clearTimeout(timer);timer=undefined;if(document.hidden||!listeners.size)return;timer=setTimeout(()=>{for(const listener of listeners)listener();run();},period-Date.now()%period+20);};
 const visibility=()=>{if(!document.hidden)for(const listener of listeners)listener();run();};
 return listener=>{
  listeners.add(listener);if(listeners.size===1){document.addEventListener('visibilitychange',visibility);run();}
  return()=>{listeners.delete(listener);if(!listeners.size){clearTimeout(timer);timer=undefined;document.removeEventListener('visibilitychange',visibility);}};
 };
}
const seconds=createClock(1000),minutes=createClock(60000),emptySubscribe=()=>()=>{};
export function useEventPhase(item,fine=false){
 const start=eventInstant(item?.eventStartsAt),timed=item?.kind==='iptv'&&(start!==null||Boolean(item.eventDetail||item.eventScheduleState));
 // Seconds only change the snapshot during the last minute; before that a fine badge still rerenders per minute.
 const snapshot=()=>{const now=Date.now();return fine&&start!==null&&start>now&&start-now<=60000?Math.floor(now/1000):Math.floor(now/60000);};
 useSyncExternalStore(timed?(fine?seconds:minutes):emptySubscribe,snapshot,snapshot);
 return timed?eventPhaseLabel(item,Date.now()):null;
}
// App rerenders only when some event changes phase or the Santiago day changes, never per minute.
export function useLivePhases(events){
 const snapshot=()=>{const now=Date.now();let value=eventDay(now).key;for(const event of events)value+=(eventPhase(event,now)||'-')[0];return value;};
 return useSyncExternalStore(events.length?minutes:emptySubscribe,snapshot,snapshot);
}
export function EventBadge({item,fine=false,channel=false}){
 const event=useEventPhase(item,fine);
 if(!event)return channel?<span className="live-label is-channel" data-event-state="channel"><i/><span className="event-badge-copy">En directo</span></span>:null;
 return <span className={`live-label is-event is-${event.phase}`} data-event-state={event.phase}>{event.phase==='live'?<i/>:<Clock3 aria-hidden="true"/>}<span className="event-badge-copy">{event.label}</span></span>;
}
