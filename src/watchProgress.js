// D5: watched / started / unwatched from the per-profile history (seconds), explicit marks and known durations.
// An explicit «no visto» (`watched[id]===false`) wins over the ≥ 90 % rule.
export const WATCHED_FRACTION=.9;
const code=({season,episodeNumber})=>[season&&season!=='0'&&`T${season}`,episodeNumber&&`E${episodeNumber}`].filter(Boolean).join(' · ');
export function episodeState({episodeId,history={},watched={},durations={}},fallbackDuration=0){
 const progress=history[episodeId]||0,duration=durations[episodeId]||fallbackDuration||0,fraction=duration>0?Math.min(1,progress/duration):0;
 if(watched[episodeId]===true||watched[episodeId]!==false&&fraction>=WATCHED_FRACTION)return {state:'watched',remainingMinutes:0,fraction:1};
 if(progress>0)return {state:'started',remainingMinutes:duration>progress?Math.ceil((duration-progress)/60):0,fraction};
 return {state:'unwatched',remainingMinutes:0,fraction:0};
}
const isWatched=(episode,library)=>episodeState({episodeId:episode.id,...library},episode.durationSeconds).state==='watched';
export const seasonProgress=(episodes,library)=>({watched:episodes.filter(episode=>isWatched(episode,library)).length,total:episodes.length});
// Episodes in viewing order (seasons, then numbers). `recentId` is the last episode played in this series.
// Specials (season 0) are skipped unless the recent episode is one of them.
export function nextToWatch(all,{recentId,...library}){
 const regular=all.filter(episode=>episode.season!=='0'),episodes=regular.length&&!all.some(episode=>episode.id===recentId&&episode.season==='0')?regular:all;
 if(!episodes.length)return null;
 const recent=episodes.findIndex(episode=>episode.id===recentId);
 if(recent>=0)return isWatched(episodes[recent],library)?episodes[recent+1]||episodes[0]:episodes[recent];
 const last=episodes.findLastIndex(episode=>isWatched(episode,library));
 return episodes[last+1]||episodes[0];
}
// «Continuar viendo»: films in progress as before, and each series once, with its episode in progress
// («T2 · E5 · Quedan 12 min») or, once that one is finished, the next («Siguiente: T2 · E6»).
export function continueWatchingEntries(all,history,watched,durations,recent={}){
 const library={history,watched,durations};
 return all.flatMap(item=>{
  if(item.mediaType!=='series')return history[item.id]>0&&watched[item.id]!==true?[item]:[];
  const last=recent[item.id];if(!last)return [];
  const status=episodeState({episodeId:last.episodeId,...library});
  if(status.state==='watched')return last.next?[{...item,resumeEpisodeId:last.next.id,resumeLabel:`Siguiente: ${code(last.next)}`,resumeFraction:0}]:[];
  return [{...item,resumeEpisodeId:last.episodeId,resumeLabel:[code(last),status.remainingMinutes&&`Quedan ${status.remainingMinutes} min`].filter(Boolean).join(' · '),resumeFraction:status.fraction}];
 });
}
