import {useEffect,useState} from 'react';
import {STANDINGS_URL,LEADERS_URL,parseStandings,parseLeaders} from './leagueStats.js';
// Standings and leaders change after each match day: 30 min per league is plenty. Kept per league in localStorage
// so a chip already seen opens instantly; an expired copy is shown while the fresh one arrives.
const TTL=30*60000,key=slug=>`rf-football-league-v1:${slug}`;
const read=slug=>{try{const data=JSON.parse(localStorage.getItem(key(slug)));return data?.slug===slug?data:null;}catch{return null;}};
async function json(url,signal){const response=await fetch(url,{signal});if(!response.ok)throw Error('League data unavailable');return response.json();}
export function useLeagueStats(slug){
 const [state,setState]=useState({slug:null,status:'idle',standings:null,leaders:null});
 useEffect(()=>{
  if(!slug){setState({slug:null,status:'idle',standings:null,leaders:null});return;}
  const stored=read(slug);setState(stored?{...stored,status:'ready'}:{slug,status:'loading',standings:null,leaders:null});
  if(stored&&Date.now()-stored.updatedAt<TTL)return;
  let disposed=false;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  Promise.allSettled([json(STANDINGS_URL(slug),controller.signal),json(LEADERS_URL(slug),controller.signal)]).then(([standings,leaders])=>{
   if(disposed)return;
   const data={slug,updatedAt:Date.now(),standings:standings.status==='fulfilled'?parseStandings(standings.value):stored?.standings||null,leaders:leaders.status==='fulfilled'?parseLeaders(leaders.value):stored?.leaders||null};
   if(!data.standings&&!data.leaders){setState(previous=>previous.slug===slug?{...previous,status:stored?'ready':'error'}:previous);return;}
   setState(previous=>previous.slug===slug?{...data,status:'ready'}:previous);
   if(standings.status==='fulfilled'&&leaders.status==='fulfilled')try{localStorage.setItem(key(slug),JSON.stringify(data));}catch{}
  }).finally(()=>clearTimeout(timer));
  return()=>{disposed=true;clearTimeout(timer);controller.abort();};
 },[slug]);
 return state.slug===slug?state:{slug,status:slug?'loading':'idle',standings:null,leaders:null};
}
