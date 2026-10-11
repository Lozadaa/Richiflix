import {useEffect,useMemo,useState} from 'react';
import {publishScores} from './gameScores.js';
import {FOOTBALL_SCOREBOARD_URL,scoreboardRequests,scoreboardGames,reconcileFootballEvent} from './footballSchedule.js';
// Same cadence as MLB (useEventSchedule): 5 min, 2 min with a match in play, 55 s while a live crest is on screen.
const TTL=5*60000,LIVE_TTL=2*60000,WATCHED_TTL=55000,key='rf-football-schedule-v1';
const playing=games=>games.some(game=>game.detail==='In Progress'||(game.detail==='Scheduled'&&game.startsAt<=Date.now()&&Date.now()<game.startsAt+2.25*3600000));
const watched=()=>!document.hidden&&Boolean(document.querySelector('.mlb-artwork[data-live]'));
const ttl=games=>playing(games)?watched()?WATCHED_TTL:LIVE_TTL:TTL;
const same=(a,b)=>a?.requests===b?.requests&&JSON.stringify(a.games)===JSON.stringify(b.games);
function cached(requests){try{const data=JSON.parse(localStorage.getItem(key));return data?.requests===requests&&Array.isArray(data.games)&&Date.now()-data.updatedAt<ttl(data.games)?data:null;}catch{return null;}}
async function scoreboard(request,signal){
 const [league,date]=request.split('|'),url=new URL(`${FOOTBALL_SCOREBOARD_URL}/${league}/scoreboard`);url.search=new URLSearchParams({dates:date}).toString();
 const response=await fetch(url,{signal});if(!response.ok)throw Error('Scoreboard unavailable');
 return scoreboardGames(await response.json(),league);
}
export function useFootballSchedule(channels){
 const requests=useMemo(()=>scoreboardRequests(channels).join(','),[channels]);
 const [schedule,setSchedule]=useState(null);
 useEffect(()=>{
  if(!requests){setSchedule(null);return;}
  let disposed=false,inflight=false,controller;
  const stored=cached(requests);setSchedule(stored);
  const refresh=async force=>{
   if(disposed||document.hidden||inflight)return;
   const fresh=force===true?null:cached(requests);if(fresh){setSchedule(previous=>same(previous,fresh)?previous:fresh);return;}
   inflight=true;controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
   try{
    // One league failing keeps the others; with every request failing the last scores stay, marked stale.
    const results=await Promise.allSettled(requests.split(',').map(request=>scoreboard(request,controller.signal)));
    if(results.every(result=>result.status==='rejected'))throw Error('Offline');
    const data={requests,updatedAt:Date.now(),games:results.flatMap(result=>result.status==='fulfilled'?result.value:[])};
    if(!disposed){setSchedule(previous=>same(previous,data)?previous:data);try{localStorage.setItem(key,JSON.stringify(data));}catch{}}
   }catch{
    if(!disposed)setSchedule(previous=>previous?.games.some(game=>game.score&&!game.score.stale)?{...previous,games:previous.games.map(game=>game.score?{...game,score:{...game.score,stale:true}}:game)}:previous);
   }finally{clearTimeout(timer);inflight=false;}
  };
  refresh();const interval=setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);
  return()=>{disposed=true;controller?.abort();clearInterval(interval);document.removeEventListener('visibilitychange',refresh);};
 },[requests]);
 const games=schedule?.requests===requests?schedule.games:null;
 useEffect(()=>publishScores('futbol',games||[]),[games]);
 return useMemo(()=>games?channels.map(item=>reconcileFootballEvent(item,games)):channels,[channels,games]);
}
