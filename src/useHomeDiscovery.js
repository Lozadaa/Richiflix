import {useMemo,useState} from 'react';
import {rotateDiscovery} from './discoveryCollections.js';
import {useStableEvent} from './useStableEvent.js';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function useHomeDiscovery(collections,profileId){
 const key=`rf-home-discovery:${profileId}`;
 const [session,setSession]=useState(()=>{const date=today();try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.date===date&&Number.isSafeInteger(saved.revision)&&saved.revision>=0)return saved;}catch{}return {date,revision:0};});
 const change=useStableEvent(()=>setSession(previous=>{const date=today(),next={date,revision:previous.date===date?(previous.revision+1)%100000:0};try{localStorage.setItem(key,JSON.stringify(next));}catch{}return next;}));
 const groups=useMemo(()=>rotateDiscovery(collections,`${profileId}:${session.date}`,session.revision),[collections,profileId,session]);
 return {groups,change};
}
