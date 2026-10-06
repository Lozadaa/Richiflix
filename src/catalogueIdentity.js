// A match name is not a channel identity. Only the same source and stream are merged.
import {cooperativeForEach} from './cooperativeWork.js';
function hash(value){let number=2166136261;for(const char of value)number=Math.imul(number^char.charCodeAt(0),16777619);return (number>>>0).toString(36);}
function accumulator(){
 const identities=new Map(),ids=new Map(),result=[];
 const add=item=>{
  const identity=JSON.stringify([item.sourceId||'eterboxtv',item.mediaType||item.kind,item.streamId||item.id,item.url||item.id]);
  const existing=identities.get(identity);
  if(existing){const genres=[...new Set([...(existing.genres||[existing.genre]),...(item.genres||[item.genre])].filter(Boolean))];existing.genres=genres;return;}
  let id=item.id;if(ids.has(id)&&ids.get(id)!==identity)id=`${id}-${hash(identity)}`;
  const normalized={...item,id,genres:[...new Set((item.genres||[item.genre]).filter(Boolean))]};identities.set(identity,normalized);ids.set(id,identity);result.push(normalized);
 };return {add,result};
}
export function deduplicateItems(items){const output=accumulator();for(const item of items)output.add(item);return output.result;}
export async function deduplicateItemsAsync(items,options){const output=accumulator();await cooperativeForEach(items,output.add,options);return output.result;}
