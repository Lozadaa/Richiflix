import {useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import {MLB_SCHEDULE_URL,mlbEventDate,scheduleGames,reconcileMLBEvent} from './mlbSchedule.js';
const TTL=5*60000,LIVE_TTL=2*60000,WATCHED_TTL=55000,key='rf-mlb-schedule-v1';
const playing=games=>games.some(game=>/in progress|live/i.test(game.detail||'')||(!/final|game over|completed|postponed|cancel/i.test(game.detail||'')&&game.startsAt<=Date.now()&&Date.now()<game.startsAt+3.5*3600000));
// Fase L5: with games in play the score refreshes every 60 s while a live crest is on screen
// (cards of «En juego ahora»/«Ahora en vivo», the MLB page, the expanded card or the banner all draw
// `.mlb-artwork[data-live]`; virtual rows unmount what is off screen), every 2 min otherwise, 5 min with no games in play.
const watched=()=>!document.hidden&&Boolean(document.querySelector('.mlb-artwork[data-live]'));
const ttl=games=>playing(games)?watched()?WATCHED_TTL:LIVE_TTL:TTL;
const same=(a,b)=>a?.range===b?.range&&JSON.stringify(a.games)===JSON.stringify(b.games);
function cached(range){try{const data=JSON.parse(localStorage.getItem(key));return data?.range===range&&Array.isArray(data.games)&&Date.now()-data.updatedAt<ttl(data.games)?data:null;}catch{return null;}}
// Scores by gamePk for MatchupArtwork, which only receives the matchup; a crest rerenders only when its own game changes.
let scores=new Map();const listeners=new Set();
function publish(games){
 const next=new Map();for(const game of games)if(game.score){const old=scores.get(game.id);next.set(game.id,JSON.stringify(old)===JSON.stringify(game.score)?old:game.score);}
 if(next.size===scores.size&&[...next].every(([id,score])=>scores.get(id)===score))return;
 scores=next;for(const listener of listeners)listener();
}
const subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
export const useGameScore=id=>useSyncExternalStore(subscribe,()=>id?scores.get(id)||null:null,()=>null);
export function useEventSchedule(channels){
 const range=useMemo(()=>{
  const dates=[...new Set(channels.filter(item=>/\bmlb\b|baseball|b[eé]isbol/i.test(`${item.title} ${item.genre||''}`)).map(mlbEventDate).filter(Boolean))].sort();
  if(!dates.length||Date.parse(dates.at(-1))-Date.parse(dates[0])>7*86400000)return '';
  return `${dates[0]}|${dates.at(-1)}`;
 },[channels]);
 const [schedule,setSchedule]=useState(null);
 useEffect(()=>{
  if(!range){setSchedule(null);return;}
  let disposed=false,inflight=false,controller,known=[];
  const stored=cached(range);setSchedule(stored);known=stored?.games||[];
  // One shared timer; an unchanged answer keeps the same object, so App does not rerender.
  const refresh=async force=>{
   if(disposed||document.hidden||inflight)return;
   const fresh=force===true?null:cached(range);if(fresh){known=fresh.games;setSchedule(previous=>same(previous,fresh)?previous:fresh);return;}
   // The linescore is only asked for while some game is in play.
   const hydrate=playing(known);let again=false;
   inflight=true;controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
   try{
    const [startDate,endDate]=range.split('|'),url=new URL(MLB_SCHEDULE_URL);url.search=new URLSearchParams({sportId:1,startDate,endDate,...hydrate&&{hydrate:'linescore'}}).toString();
    const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('Schedule unavailable');
    const data={range,updatedAt:Date.now(),games:scheduleGames(await response.json())};known=data.games;again=!hydrate&&playing(known);
    if(!disposed){setSchedule(previous=>same(previous,data)?previous:data);try{localStorage.setItem(key,JSON.stringify(data));}catch{}}
   }catch{
    // Offline: the provider/estimated phase stays and the last known score is kept, marked stale; never invented.
    if(!disposed)setSchedule(previous=>previous?.games.some(game=>game.score&&!game.score.stale)?{...previous,games:previous.games.map(game=>game.score?{...game,score:{...game.score,stale:true}}:game)}:previous);
   }finally{clearTimeout(timer);inflight=false;}
   if(again)refresh(true);
  };
  refresh();const interval=setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);
  return()=>{disposed=true;controller?.abort();clearInterval(interval);document.removeEventListener('visibilitychange',refresh);};
 },[range]);
 const games=schedule?.range===range?schedule.games:null;
 useEffect(()=>publish(games||[]),[games]);
 return useMemo(()=>games?channels.map(item=>reconcileMLBEvent(item,games)):channels,[channels,games]);
}
