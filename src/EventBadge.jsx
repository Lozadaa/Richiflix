import React,{useSyncExternalStore} from 'react';
import {Clock3} from 'lucide-react';
import {eventCountdown,eventInstant,eventStartLabel} from './eventTime.js';

let now=Date.now(),timer;const listeners=new Set();
const tick=()=>{now=Date.now();for(const listener of listeners)listener();};
const visibility=()=>{clearInterval(timer);timer=undefined;if(!document.hidden&&listeners.size){tick();timer=setInterval(tick,1000);}};
function subscribe(listener){
 listeners.add(listener);if(listeners.size===1){now=Date.now();document.addEventListener('visibilitychange',visibility);visibility();}
 return()=>{listeners.delete(listener);if(!listeners.size){clearInterval(timer);timer=undefined;document.removeEventListener('visibilitychange',visibility);}};
}
const emptySubscribe=()=>()=>{};
export function useEventCountdown(item){
 const startsAt=eventInstant(item?.eventStartsAt),active=startsAt!==null&&startsAt>Date.now();
 const value=()=>active?(startsAt-now<=60000?now:Math.ceil((startsAt-now)/60000)):0;
 const clock=useSyncExternalStore(active?subscribe:emptySubscribe,value,value);
 return eventCountdown(item||{},active?(startsAt-now<=60000?clock:now):Date.now());
}
export function EventBadge({item}){
 const event=useEventCountdown(item),spanish=/Spanish|Espa[nñ]ol/i.test(item.title);
 return <span className={`live-label ${event?.state==='upcoming'?'is-upcoming':''} ${event?.state==='scheduled'?'is-scheduled':''}`} data-event-state={event?.state||'live'}>
  {event||item.eventScheduleState?<Clock3 aria-hidden="true"/>:<i/>}<span className="event-badge-copy">{item.eventScheduleState==='postponed'?'Aplazado':event?.label||'EN VIVO'}{spanish?' · ES':''}{event&&<small>{eventStartLabel(item)}</small>}</span>
 </span>;
}
