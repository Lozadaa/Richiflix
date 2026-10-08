import {useEffect,useMemo,useRef,useState} from 'react';
import {xtreamClient} from './xtreamClient.js';
import {createGuideQueue,parseShortEpg} from './channelGuide.js';
import {registerPerformanceStats} from './focusPaintDiagnostics.js';

// Fase L4: guide for the channels App hands over (focused first, then its neighbours in the mounted
// window). Nothing is asked until a channel is wanted; `enabled` false (burst, dialog, player) pauses
// the queue and holds replies, so no card rerenders under a held key. `delay` is extra settling for PC
// (TV already waits for the banner's 480 ms commit). Replies reach the cards through App's metadata.
export function useChannelGuide(channels,enabled,{scope='',delay=0}={}){
 const queue=useMemo(()=>createGuideQueue({load:async item=>parseShortEpg(await xtreamClient().shortEpg?.(item.streamId,item.sourceId))}),[scope]);
 const [guide,setGuide]=useState({}),active=useRef(enabled),dirty=useRef(false),publish=useRef();active.current=enabled;
 useEffect(()=>{setGuide({});publish.current=()=>{dirty.current=false;setGuide(previous=>{const next=queue.snapshot(),keys=Object.keys(next);return keys.length===Object.keys(previous).length&&keys.every(id=>previous[id]===next[id])?previous:next;});};
  const unsubscribe=queue.subscribe(()=>{if(active.current)publish.current();else dirty.current=true;});
  const unregister=registerPerformanceStats('channelGuide',queue.stats);return()=>{unsubscribe();unregister();queue.pause();};},[queue]);
 const key=channels.map(item=>item.id).join('\n');
 useEffect(()=>{
  if(!enabled){queue.pause();return;}
  if(dirty.current)publish.current();if(!channels.length){queue.want([]);return;}
  const timer=setTimeout(()=>{queue.want(channels);queue.resume();},delay);return()=>clearTimeout(timer);
 },[queue,enabled,key,delay]);
 return guide;
}
