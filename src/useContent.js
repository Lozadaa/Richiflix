import {useEffect,useSyncExternalStore} from 'react';
import {contentStore,loadContent,emptyContent} from './contentStore.js';
export function useContent(enabled=true){
 const state=useSyncExternalStore(contentStore.subscribe,contentStore.get);
 useEffect(()=>{if(enabled)loadContent();},[enabled]);
 return {...(enabled?state:emptyContent),refresh:force=>loadContent(force)};
}
