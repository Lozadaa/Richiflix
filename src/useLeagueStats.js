import {useCallback,useEffect,useSyncExternalStore} from 'react';
import {STANDINGS_URL,LEADERS_URL,parseStandings,parseLeaders} from './leagueStats.js';
import {FOOTBALL_LEAGUES} from './footballArtwork.js';
// Standings and leaders change after each match day: 30 min per league is plenty. One shared store: memory first,
// then localStorage, so a league already seen (or prefetched while the page opened) switches with no wait;
// an expired copy stays on screen while the fresh one arrives («Actualizando»). Requests are deduplicated.
const TTL=30*60000,key=slug=>`rf-football-league-v1:${slug}`;
const memory=new Map(),inflight=new Map(),failed=new Set(),listeners=new Set();
const emit=()=>{for(const listener of listeners)listener();};
function cached(slug){
 if(!memory.has(slug)){try{const data=JSON.parse(localStorage.getItem(key(slug)));if(data?.slug===slug&&(data.standings||data.leaders))memory.set(slug,data);}catch{}}
 return memory.get(slug)||null;
}
async function json(url,signal){const response=await fetch(url,{signal});if(!response.ok)throw Error('League data unavailable');return response.json();}
export function loadLeague(slug,{force=false}={}){
 const known=cached(slug);
 if(!force&&known&&Date.now()-known.updatedAt<TTL)return Promise.resolve(known);
 if(inflight.has(slug))return inflight.get(slug);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 const work=Promise.allSettled([json(STANDINGS_URL(slug),controller.signal),json(LEADERS_URL(slug),controller.signal)]).then(([standings,leaders])=>{
  const data={slug,updatedAt:Date.now(),standings:standings.status==='fulfilled'?parseStandings(standings.value):known?.standings||null,leaders:leaders.status==='fulfilled'?parseLeaders(leaders.value):known?.leaders||null};
  if(!data.standings&&!data.leaders)throw Error('League data unavailable');
  memory.set(slug,data);failed.delete(slug);
  if(standings.status==='fulfilled'&&leaders.status==='fulfilled')try{localStorage.setItem(key(slug),JSON.stringify(data));}catch{}
  return data;
 }).catch(error=>{failed.add(slug);throw error;}).finally(()=>{clearTimeout(timer);inflight.delete(slug);emit();});
 inflight.set(slug,work);failed.delete(slug);emit();
 return work;
}
// Opening «Fútbol» warms every league one after another while the app is idle: the first chip already has its table.
let warming=false;
export function prefetchLeagues(){
 if(warming)return;warming=true;
 const idle=window.requestIdleCallback?callback=>window.requestIdleCallback(callback,{timeout:3000}):callback=>setTimeout(callback,400);
 const next=index=>{if(index>=FOOTBALL_LEAGUES.length){warming=false;return;}idle(()=>loadLeague(FOOTBALL_LEAGUES[index][0]).catch(()=>{}).finally(()=>next(index+1)));};
 next(0);
}
const subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
// status: 'loading' (nothing to show yet) · 'ready' · 'refreshing' (showing a copy, a newer one is on its way) · 'error'.
function snapshot(slug){
 if(!slug)return 'idle';
 const data=cached(slug),busy=inflight.has(slug);
 return data?busy?'refreshing':'ready':busy?'loading':failed.has(slug)?'error':'loading';
}
export function useLeagueStats(slug){
 const status=useSyncExternalStore(subscribe,()=>snapshot(slug),()=>'idle'),data=status==='idle'?null:cached(slug);
 useEffect(()=>{if(slug)loadLeague(slug).catch(()=>{});},[slug]);
 const retry=useCallback(()=>{if(slug)loadLeague(slug,{force:true}).catch(()=>{});},[slug]);
 return {status,standings:data?.standings||null,leaders:data?.leaders||null,updatedAt:data?.updatedAt||null,retry};
}
