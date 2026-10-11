import {useCallback,useEffect,useSyncExternalStore} from 'react';
import {STANDINGS_URL,LEADERS_URL,FIXTURES_URL,parseStandings,parseLeaders,parseFixtures,fixtureMonths,competition} from './leagueStats.js';
// One shared store per competition: memory first, then localStorage, so a league already seen (or warmed from its chip)
// switches with no wait; an expired copy stays on screen while the fresh one arrives («Actualizando»). Requests are
// deduplicated. Standings and leaders change after each match day (30 min); with a match in play everything refreshes
// every minute while the panel is open, so the table's live scores and the «Fecha» tab follow the game.
const TTL=30*60000,LIVE_TTL=55000,key=slug=>`rf-football-league-v2:${slug}`;
const memory=new Map(),inflight=new Map(),failed=new Set(),listeners=new Set();
const emit=()=>{for(const listener of listeners)listener();};
export const hasLive=(data,now=Date.now())=>Boolean(data?.fixtures?.some(match=>match.state==='live'||match.state==='pre'&&match.date<=now+5*60000&&match.date>=now-3*3600000));
const fresh=(data,now=Date.now())=>now-data.updatedAt<(hasLive(data,now)?LIVE_TTL:TTL);
function cached(slug){
 if(!memory.has(slug)){try{const data=JSON.parse(localStorage.getItem(key(slug)));if(data?.slug===slug&&(data.standings||data.leaders||data.fixtures?.length))memory.set(slug,data);}catch{}}
 return memory.get(slug)||null;
}
async function json(url,signal){const response=await fetch(url,{signal});if(!response.ok)throw Error('League data unavailable');return response.json();}
export function loadLeague(slug,{force=false}={}){
 const known=cached(slug),entry=competition(slug);
 if(!entry)return Promise.reject(Error('Unknown competition'));
 if(!force&&known&&fresh(known))return Promise.resolve(known);
 if(inflight.has(slug))return inflight.get(slug);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000),table=entry.table!==false;
 // National teams: several competitions, this month and the next only (friendlies are spread over the calendar).
 const months=entry.national?fixtureMonths().slice(1):fixtureMonths(),sources=entry.sources||[slug];
 const fixtureRequests=sources.flatMap(source=>months.map(month=>json(FIXTURES_URL(source,month),controller.signal).then(data=>parseFixtures(data,source))));
 const work=Promise.allSettled([table?json(STANDINGS_URL(slug),controller.signal):null,table?json(LEADERS_URL(slug),controller.signal):null,...fixtureRequests]).then(([standings,leaders,...fixtures])=>{
  const ok=result=>result.status==='fulfilled'&&result.value;
  const fixtureList=fixtures.some(ok)?[...new Map(fixtures.filter(ok).flatMap(result=>result.value).map(match=>[match.id,match])).values()].sort((a,b)=>a.date-b.date):known?.fixtures||[];
  const data={slug,updatedAt:Date.now(),standings:ok(standings)?parseStandings(standings.value):known?.standings||null,leaders:ok(leaders)?parseLeaders(leaders.value):known?.leaders||null,fixtures:fixtureList};
  if(!data.standings&&!data.leaders&&!data.fixtures.length)throw Error('League data unavailable');
  memory.set(slug,data);failed.delete(slug);
  try{localStorage.setItem(key(slug),JSON.stringify(data));}catch{}
  return data;
 }).catch(error=>{failed.add(slug);throw error;}).finally(()=>{clearTimeout(timer);inflight.delete(slug);emit();});
 inflight.set(slug,work);failed.delete(slug);emit();
 return work;
}
// Warm a few competitions one after another while the app is idle (chips with matches today, a focused chip).
const queue=[];let warming=false;
export function prefetchLeagues(slugs){
 for(const slug of slugs)if(competition(slug)&&!queue.includes(slug))queue.push(slug);
 if(warming)return;warming=true;
 const idle=window.requestIdleCallback?callback=>window.requestIdleCallback(callback,{timeout:2500}):callback=>setTimeout(callback,300);
 const next=()=>{const slug=queue.shift();if(!slug){warming=false;return;}idle(()=>loadLeague(slug).catch(()=>{}).finally(next));};
 next();
}
const subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
// status: 'loading' (nothing to show yet) · 'ready' · 'refreshing' (showing a copy, a newer one is on its way) · 'error'.
function snapshot(slug){
 if(!slug)return 'idle';
 const data=cached(slug),busy=inflight.has(slug);
 return `${data?busy?'refreshing':'ready':busy?'loading':failed.has(slug)?'error':'loading'}:${data?.updatedAt||0}`;
}
export function useLeagueStats(slug){
 const [status]=useSyncExternalStore(subscribe,()=>snapshot(slug),()=>'idle').split(':'),data=status==='idle'?null:cached(slug);
 useEffect(()=>{
  if(!slug)return;loadLeague(slug).catch(()=>{});
  // While open: a minute tick refreshes only when something is in play (loadLeague keeps the 30 min TTL otherwise).
  const tick=setInterval(()=>{if(!document.hidden)loadLeague(slug).catch(()=>{});},60000);
  return()=>clearInterval(tick);
 },[slug]);
 const retry=useCallback(()=>{if(slug)loadLeague(slug,{force:true}).catch(()=>{});},[slug]);
 return {status,standings:data?.standings||null,leaders:data?.leaders||null,fixtures:data?.fixtures||null,updatedAt:data?.updatedAt||null,retry};
}
