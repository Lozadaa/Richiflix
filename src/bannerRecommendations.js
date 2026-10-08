import {TMDB_BEST,TMDB_RECENT} from './tmdbSelections.js';
const usable=item=>Boolean(item&&['movie','series'].includes(item.mediaType)&&(item.backdropImage||item.image));
// TV banner slides: the first title to continue, then TMDB best/recent picks
// alternating movie and series. Before TMDB answers, the featured titles stay.
export function recommendedBanner({continuing=[],collections=[],featured=[],limit=8}={}){
 const picked=new Map(),add=(item,check=usable)=>{if(picked.size<limit&&check(item)&&!picked.has(item.id))picked.set(item.id,item);};
 add(continuing.find(usable));
 const queues=[TMDB_BEST,TMDB_RECENT].flatMap(name=>['movie','series'].map(type=>collections.find(group=>group.name===name&&group.type===type)?.items||[])).filter(items=>items.length);
 for(let index=0;picked.size<limit&&queues.some(items=>index<items.length);index++)for(const items of queues)add(items[index]);
 if(!queues.length)for(const item of featured)add(item,Boolean);
 return [...picked.values()];
}
