import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {createProfileLibrary} from './libraryStorage.js';

export function useProfileLibrary(profileId){
 const store=useMemo(()=>createProfileLibrary(profileId),[profileId]);
 const state=useSyncExternalStore(store.subscribe,store.get,store.get);
 useEffect(()=>{
  store.load();
  const flush=()=>store.flush().catch(()=>{}),visibility=()=>{if(document.hidden)flush();};
  window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',visibility);
  return()=>{window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',visibility);flush();};
 },[store]);
 return {...state,setFavorites:store.setFavorites,setHistory:store.setHistory,setTeams:store.setTeams,setIntros:store.setIntros,setWatched:store.setWatched,setDurations:store.setDurations,setRecent:store.setRecent};
}
