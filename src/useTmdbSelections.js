import {useEffect,useState} from 'react';
import {xtreamClient} from './xtreamClient.js';
const empty={status:'idle',metadata:{},collections:[]};
export function useTmdbSelections(key,enabled=true){
 const [snapshot,setSnapshot]=useState({key,data:empty});
 useEffect(()=>{
  let closed=false;setSnapshot({key,data:enabled?{...empty,status:'loading'}:empty});
  if(!enabled)return;
  // The app is usable first. Ranking download/matching runs in the worker or
  // Electron process, and only a small completed result reaches React.
  const timer=setTimeout(()=>Promise.resolve().then(()=>xtreamClient().recommendations()).then(data=>{if(!closed)setSnapshot({key,data});}).catch(()=>{if(!closed)setSnapshot({key,data:{...empty,status:'unavailable'}});}),1000);
  return()=>{closed=true;clearTimeout(timer);};
 },[key,enabled]);
 return snapshot.key===key?snapshot.data:{...empty,status:enabled?'loading':'idle'};
}
