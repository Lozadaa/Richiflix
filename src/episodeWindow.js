// Prefix positions are prepared once per episode collection/viewport size.
// Selection and scrolling only search these numbers, never all mounted boxes.
export function episodePositions(episodes,rowHeight,headingHeight){
 const offsets=[0];for(const episode of episodes)offsets.push(offsets.at(-1)+rowHeight+(episode.groupStart?headingHeight:0));return offsets;
}
function indexAt(offsets,position){let low=0,high=offsets.length-1;while(low<high){const mid=Math.ceil((low+high)/2);if(offsets[mid]<=position)low=mid;else high=mid-1;}return Math.min(offsets.length-2,low);}
export function episodeWindow({offsets,offset=0,height,focusedIndex=-1,overscan=2}){
 const count=offsets.length-1;if(!count)return [];
 const start=Math.max(0,indexAt(offsets,Math.max(0,offset))-overscan),end=Math.min(count,indexAt(offsets,Math.max(0,offset)+height)+overscan+1),indices=[];
 for(let index=start;index<end;index++)indices.push(index);
 if(focusedIndex>=0&&focusedIndex<count&&(focusedIndex<start||focusedIndex>=end))indices.push(focusedIndex);
 return indices.sort((a,b)=>a-b);
}
// D3: previous/next episode across seasons; specials (season 0) only step among themselves.
export function adjacentEpisode(seasons,episodeId,direction){
 const special=seasons?.find(group=>group.episodes.some(episode=>episode.id===episodeId))?.season==='0';
 const list=(seasons||[]).filter(group=>(group.season==='0')===special).flatMap(group=>group.episodes),index=list.findIndex(episode=>episode.id===episodeId);
 return index<0?null:list[index+direction]||null;
}
