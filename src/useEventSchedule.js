import {useEffect,useMemo,useState} from 'react';
import {MLB_SCHEDULE_URL,mlbEventDate,scheduleGames,reconcileMLBEvent} from './mlbSchedule.js';
const TTL=5*60000,key='rf-mlb-schedule-v1';
function cached(range){try{const data=JSON.parse(localStorage.getItem(key));return data?.range===range&&Date.now()-data.updatedAt<TTL&&Array.isArray(data.games)?data:null;}catch{return null;}}
export function useEventSchedule(channels){
 const range=useMemo(()=>{
  const dates=[...new Set(channels.filter(item=>/\bmlb\b|baseball|b[eé]isbol/i.test(`${item.title} ${item.genre||''}`)).map(mlbEventDate).filter(Boolean))].sort();
  if(!dates.length||Date.parse(dates.at(-1))-Date.parse(dates[0])>7*86400000)return '';
  return `${dates[0]}|${dates.at(-1)}`;
 },[channels]);
 const [schedule,setSchedule]=useState(null);
 useEffect(()=>{
  if(!range){setSchedule(null);return;}
  let disposed=false,inflight=false,controller;
  const stored=cached(range);setSchedule(stored);
  const refresh=async()=>{
   if(disposed||document.hidden||inflight)return;
   const fresh=cached(range);if(fresh){setSchedule(fresh);return;}
   inflight=true;controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
   try{
    const [startDate,endDate]=range.split('|'),url=new URL(MLB_SCHEDULE_URL);url.search=new URLSearchParams({sportId:1,startDate,endDate}).toString();
    const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('Schedule unavailable');
    const data={range,updatedAt:Date.now(),games:scheduleGames(await response.json())};
    if(!disposed){setSchedule(data);try{localStorage.setItem(key,JSON.stringify(data));}catch{}}
   }catch{/* Keep the converted provider time when the official calendar is offline. */}finally{clearTimeout(timer);inflight=false;}
  };
  refresh();const interval=setInterval(refresh,TTL);document.addEventListener('visibilitychange',refresh);
  return()=>{disposed=true;controller?.abort();clearInterval(interval);document.removeEventListener('visibilitychange',refresh);};
 },[range]);
 return useMemo(()=>schedule?.range===range?channels.map(item=>reconcileMLBEvent(item,schedule.games)):channels,[channels,schedule,range]);
}
