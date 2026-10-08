import {useEffect,useRef,useState} from 'react';
import {fetchIntro,seasonEpisodeNumber} from './introDatabase.js';
import {learnIntro,introWindow,discardIntro,introKey,shouldOffer} from './introMarks.js';

// D4: «Saltar intro»/«Saltar resumen» for series episodes. TheIntroDB first; the season mark learned
// from the viewer's jumps when the database has nothing. Each window is offered once, for ≤ 10 s.
export function useIntroSkip({item,series,seasons,position,enabled,intros,setIntros}){
 const [database,setDatabase]=useState([]),[,setTick]=useState(0),seen=useRef(new Map()),skipped=useRef(false);
 const where={seriesId:series?.id,season:item.season};
 useEffect(()=>{
  setDatabase([]);seen.current=new Map();skipped.current=false;if(!enabled||!series?.tmdbId)return;
  let active=true;fetchIntro({tmdbId:series.tmdbId,season:item.season,episode:seasonEpisodeNumber(seasons,item)}).then(segments=>{if(active)setDatabase(segments);});
  return()=>{active=false;};
 },[item.id,enabled,series?.tmdbId]);
 const learned=enabled?introWindow(intros,where):null,windows=!enabled?[]:database.length?database:learned?[learned]:[];
 const current=windows.find(window=>position>=Math.max(0,window.start-15)&&position<=window.end-1),key=current&&`${current.kind}:${current.start}`,state=key?seen.current.get(key)||{}:{};
 const visible=Boolean(current)&&shouldOffer({position,window:current,dismissed:state.dismissed,shownAt:state.shownAt??null,now:Date.now()});
 useEffect(()=>{if(!visible||state.shownAt!=null)return;seen.current.set(key,{shownAt:Date.now()});const timer=setTimeout(()=>setTick(value=>value+1),10050);return()=>clearTimeout(timer);},[visible,key]);
 const dismiss=()=>{if(key){seen.current.set(key,{...state,dismissed:true});setTick(value=>value+1);}};
 return {
  offer:visible?{key,end:current.end,label:current.kind==='recap'?'Saltar resumen':'Saltar intro'}:null,
  skip:()=>{skipped.current=true;dismiss();return current?.end;},dismiss,
  // From the seek accumulator: forward bursts teach the season mark; rewinding right after «Saltar intro» discards it.
  applied:({from,to})=>{
   if(!enabled||!series?.id)return;
   if(to>from)setIntros(marks=>learnIntro(marks,{...where,from,to}));
   else if(skipped.current&&from<420){skipped.current=false;setIntros(marks=>discardIntro(marks,introKey(where)));}
  },
 };
}
